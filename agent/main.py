import asyncio
import json
import os
import requests

from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli, JobProcess
from livekit.agents.llm import (
    ChatContext,
    ChatMessage,
)
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.agents.log import logger
from livekit.plugins import deepgram, silero, cartesia, openai
from typing import List, Any

from dotenv import load_dotenv

load_dotenv()


def prewarm(proc: JobProcess):
    # preload models when process starts to speed up first interaction
    proc.userdata["vad"] = silero.VAD.load()

    # fetch cartesia voices

    headers = {
        "X-API-Key": os.getenv("CARTESIA_API_KEY", ""),
        "Cartesia-Version": "2024-08-01",
        "Content-Type": "application/json",
    }
    response = requests.get("https://api.cartesia.ai/voices", headers=headers)
    if response.status_code == 200:
        proc.userdata["cartesia_voices"] = response.json()
    else:
        logger.warning(f"Failed to fetch Cartesia voices: {response.status_code}")


async def entrypoint(ctx: JobContext):
    initial_ctx = ChatContext(
        messages=[
            ChatMessage(
                role="system",
                content="You are a voice assistant created by LiveKit. Your interface with users will be voice. Pretend we're having a conversation, no special formatting or headings, just natural speech.",
            )
        ]
    )
    cartesia_voices: List[dict[str, Any]] = ctx.proc.userdata["cartesia_voices"]

    tts = cartesia.TTS(
        model="sonic-2",
    )
    agent = VoicePipelineAgent(
        vad=ctx.proc.userdata["vad"],
        stt=deepgram.STT(),
        llm=openai.LLM(model="gpt-4o-mini"),
        tts=tts,
        chat_ctx=initial_ctx,
    )

    is_user_speaking = False
    is_agent_speaking = False

    @ctx.room.on("participant_metadata_changed")
    def on_participant_metadata_changed(
        participant: rtc.Participant, old_metadata: str, new_metadata: str
    ):
        # check for metadata changes from the user itself
        if participant.kind != rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
            return

        try:
            data = json.loads(new_metadata or "{}")
            voice_id = data.get("voiceId")
            logger.info(
                f"participant {participant.identity} metadata changed: {new_metadata}"
            )
            
            if voice_id:
                logger.info(
                    f"participant {participant.identity} requested voice change: {voice_id}"
                )
                
                voice_data = next(
                    (voice for voice in cartesia_voices if voice["id"] == voice_id), None
                )
                if not voice_data:
                    logger.warning(f"Voice {voice_id} not found")
                    return
                if "embedding" in voice_data:
                    language = "en"
                    if "language" in voice_data and voice_data["language"] != "en":
                        language = voice_data["language"]
                    tts._opts.voice = voice_data["embedding"]
                    tts._opts.language = language
                    logger.info(f"🔄 Switched voice to {voice_id}")
                    # allow user to confirm voice change as long as no one is speaking
                    if not (is_agent_speaking or is_user_speaking):
                        asyncio.create_task(
                            agent.say("How do I sound now?", allow_interruptions=True)
                        )
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse metadata JSON: {new_metadata}")
            pass

    await ctx.connect()

    @agent.on("agent_started_speaking")
    def agent_started_speaking():
        nonlocal is_agent_speaking
        is_agent_speaking = True

    @agent.on("agent_stopped_speaking")
    def agent_stopped_speaking():
        nonlocal is_agent_speaking
        is_agent_speaking = False

    @agent.on("user_started_speaking")
    def user_started_speaking():
        nonlocal is_user_speaking
        is_user_speaking = True

    @agent.on("user_stopped_speaking")
    def user_stopped_speaking():
        nonlocal is_user_speaking
        is_user_speaking = False

    # set voice listing as attribute for UI
    voices = []
    for voice in cartesia_voices:
        voices.append(
            {
                "id": voice["id"],
                "name": voice["name"],
            }
        )
    voices.sort(key=lambda x: x["name"])
    await ctx.room.local_participant.set_attributes({"voices": json.dumps(voices)})

    agent.start(ctx.room)
    await agent.say("Hi there, how are you doing today?", allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
