"use client";

import { LoadingSVG } from "@/components/button/LoadingSVG";
import { Header } from "@/components/Header";
import { Tile } from "@/components/Tile";
import { AgentMultibandAudioVisualizer } from "@/components/visualization/AgentMultibandAudioVisualizer";
import { useMultibandTrackVolume } from "@/hooks/useTrackVolume";
import { useWindowResize } from "@/hooks/useWindowResize";
import {
  useConnectionState,
  useLocalParticipant,
  useTracks,
  useVoiceAssistant,
} from "@livekit/components-react";
import { AnimatePresence, motion } from "framer-motion";
import { ConnectionState, LocalParticipant, Track } from "livekit-client";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "./button/Button";
import { MicrophoneButton } from "./MicrophoneButton";
import { MenuSVG } from "./ui/icons";

export interface AssistantProps {
  title?: string;
  logo?: ReactNode;
  onConnect: (connect: boolean, opts?: { token: string; url: string }) => void;
}

export interface Voice {
  id: string;
  user_id: string | null;
  is_public: boolean;
  name: string;
  description: string;
  created_at: Date;
  embedding: number[];
}

const headerHeight = 56;
const mobileWindowWidth = 768;
const desktopBarWidth = 72;
const desktopMaxBarHeight = 280;
const desktopMinBarHeight = 60;
const mobileMaxBarHeight = 140;
const mobileMinBarHeight = 48;
const mobileBarWidth = 48;
const barCount = 5;
const defaultVolumes = Array.from({ length: barCount }, () => [0.0]);

export default function Assistant({ title, logo, onConnect }: AssistantProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const { localParticipant } = useLocalParticipant();
  const [currentVoiceId, setCurrentVoiceId] = useState<string>("");
  const [showVoices, setShowVoices] = useState(true);
  const [isVoiceChanging, setIsVoiceChanging] = useState(false);
  const [pendingVoiceId, setPendingVoiceId] = useState<string>("");
  const [voiceChangeTimeout, setVoiceChangeTimeout] = useState<NodeJS.Timeout | null>(null);
  const windowSize = useWindowResize();
  const {
    agent: agentParticipant,
    state: agentState,
    audioTrack: agentAudioTrack,
    agentAttributes,
  } = useVoiceAssistant();
  const [isMobile, setIsMobile] = useState(false);
  const isAgentConnected = agentParticipant !== undefined;

  const roomState = useConnectionState();
  const tracks = useTracks();

  useEffect(() => {
    setShowVoices(windowSize.width >= mobileWindowWidth);
    setIsMobile(windowSize.width < mobileWindowWidth);
  }, [windowSize]);

  useEffect(() => {
    if (roomState === ConnectionState.Connected) {
      localParticipant.setMicrophoneEnabled(true);
    }
  }, [localParticipant, roomState]);

  // use voices provided by the agent
  useEffect(() => {
    if (agentAttributes?.voices) {
      setVoices(JSON.parse(agentAttributes.voices));
    }
  }, [agentAttributes?.voices]);

  // Listen for agent speech to detect voice change completion
  useEffect(() => {
    if (agentState === 'speaking' && isVoiceChanging) {
      console.log('✅ Voice change completed - agent is speaking');
      // Clear the timeout
      if (voiceChangeTimeout) {
        clearTimeout(voiceChangeTimeout);
        setVoiceChangeTimeout(null);
      }
      setIsVoiceChanging(false);
      setPendingVoiceId("");
    }
  }, [agentState, isVoiceChanging, voiceChangeTimeout]);

  const subscribedVolumes = useMultibandTrackVolume(
    agentAudioTrack?.publication.track,
    barCount
  );

  const localTracks = tracks.filter(
    ({ participant }) => participant instanceof LocalParticipant
  );
  const localMicTrack = localTracks.find(
    ({ source }) => source === Track.Source.Microphone
  );

  const localMultibandVolume = useMultibandTrackVolume(
    localMicTrack?.publication.track,
    9
  );

  const onSelectVoice = useCallback(
    (voiceId: string) => {
      // Don't allow voice changes while one is in progress
      if (isVoiceChanging) {
        console.log('⚠️ Voice change already in progress, ignoring new request');
        return;
      }
      
      setCurrentVoiceId(voiceId);
      setIsVoiceChanging(true);
      setPendingVoiceId(voiceId);
      
      // Clear any existing timeout
      if (voiceChangeTimeout) {
        clearTimeout(voiceChangeTimeout);
      }
      
      try {
        const metadata = JSON.stringify({
          voiceId: voiceId,
        });
        
        console.log(`🔄 Setting voice metadata: ${metadata}`);
        localParticipant.setMetadata(metadata);
        
        // Set timeout for voice change acknowledgment (10 seconds)
        const timeout = setTimeout(() => {
          console.warn('⏰ Voice change timeout: Agent did not acknowledge voice change within 10 seconds');
          setIsVoiceChanging(false);
          setPendingVoiceId("");
        }, 10000);
        
        setVoiceChangeTimeout(timeout);
        
      } catch (error) {
        console.error('❌ Failed to set voice metadata:', error);
        
        if (error instanceof Error) {
          if (error.message.includes('permission')) {
            console.error('⚠️ Permission denied: Unable to change voice settings. Please check your participant permissions.');
          } else if (error.message.includes('connection')) {
            console.error('⚠️ Connection error: Unable to communicate voice change to server. Please check your connection.');
          } else {
            console.error(`⚠️ Unexpected error during voice change: ${error.message}`);
          }
        }
        
        // Reset states on error
        setIsVoiceChanging(false);
        setPendingVoiceId("");
        setCurrentVoiceId("");
      }
    },
    [localParticipant, setCurrentVoiceId, isVoiceChanging, voiceChangeTimeout]
  );

  const audioTileContent = useMemo(() => {
    const conversationToolbar = (
      <div className="fixed z-50 md:absolute left-1/2 bottom-4 md:bottom-auto md:top-1/2 -translate-y-1/2 -translate-x-1/2">
        <motion.div
          className="flex gap-3"
          initial={{
            opacity: 0,
            y: 25,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: 25,
          }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
        >
          <Button
            state="destructive"
            className=""
            size="medium"
            onClick={() => {
              onConnect(roomState === ConnectionState.Disconnected);
            }}
          >
            Disconnect
          </Button>
          <MicrophoneButton localMultibandVolume={localMultibandVolume} />
          <Button
            state="secondary"
            size="medium"
            onClick={() => {
              setShowVoices(!showVoices);
            }}
          >
            <MenuSVG />
          </Button>
        </motion.div>
      </div>
    );
    const isLoading =
      roomState === ConnectionState.Connecting ||
      (!agentAudioTrack && roomState === ConnectionState.Connected);
    const startConversationButton = (
      <div className="fixed bottom-2 md:bottom-auto md:absolute left-1/2 md:top-1/2 -translate-y-1/2 -translate-x-1/2 w-11/12 md:w-auto text-center">
        <motion.div
          className="flex gap-3"
          initial={{
            opacity: 0,
            y: 50,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: 50,
          }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
        >
          <Button
            state="primary"
            size="large"
            className="relative w-full text-sm md:text-base"
            onClick={() => {
              onConnect(roomState === ConnectionState.Disconnected);
            }}
          >
            <div
              className={`w-full ${isLoading ? "opacity-0" : "opacity-100"}`}
            >
              Start a conversation
            </div>
            <div
              className={`absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 ${
                isLoading ? "opacity-100" : "opacity-0"
              }`}
            >
              <LoadingSVG diameter={24} strokeWidth={4} />
            </div>
          </Button>
        </motion.div>
      </div>
    );
    const visualizerContent = (
      <div className="flex flex-col items-center justify-space-between h-full w-full pb-12">
        <div className="h-full flex">
          <AgentMultibandAudioVisualizer
            state={agentState}
            barWidth={isMobile ? mobileBarWidth : desktopBarWidth}
            minBarHeight={isMobile ? mobileMinBarHeight : desktopMinBarHeight}
            maxBarHeight={isMobile ? mobileMaxBarHeight : desktopMaxBarHeight}
            frequencies={!agentAudioTrack ? defaultVolumes : subscribedVolumes}
            gap={16}
          />
        </div>
        <div className="min-h-20 w-full relative">
          <AnimatePresence>
            {!agentAudioTrack ? startConversationButton : null}
          </AnimatePresence>
          <AnimatePresence>
            {agentAudioTrack ? conversationToolbar : null}
          </AnimatePresence>
        </div>
      </div>
    );

    return visualizerContent;
  }, [
    localMultibandVolume,
    showVoices,
    roomState,
    agentAudioTrack,
    isMobile,
    subscribedVolumes,
    onConnect,
    agentState,
  ]);

  const voiceSelectionPanel = useMemo(() => {
    return (
      <div className="flex flex-col h-full w-full items-start">
        {isAgentConnected && voices && voices.length > 0 && (
          <div className="w-full text-foreground py-4 relative">
            <div className="sticky bg-background py-2 top-0 flex flex-row justify-between items-center px-4 text-xs uppercase tracking-wider">
              <h3 className="font-mono font-semibold text-sm">Voices</h3>
            </div>
            <div className="px-4 py-2 text-xs text-foreground leading-normal">
              <div className={"flex flex-col text-left h-full"}>
                {voices.map((voice) => (
                  <button
                    onClick={() => {
                      onSelectVoice(voice.id);
                    }}
                    disabled={isVoiceChanging}
                    className={`w-full text-left px-3 py-2 font-mono text-lg md:text-sm relative ${
                      voice.id === currentVoiceId
                        ? "bg-foreground text-background"
                        : "hover:bg-white/10"
                    } ${
                      isVoiceChanging ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      pendingVoiceId === voice.id && isVoiceChanging
                        ? "bg-yellow-500/20 border-l-2 border-yellow-500"
                        : ""
                    }`}
                    key={voice.id}
                  >
                    <div className="flex items-center justify-between">
                      <span>{voice.name}</span>
                      {pendingVoiceId === voice.id && isVoiceChanging && (
                        <div className="ml-2">
                          <LoadingSVG diameter={16} strokeWidth={2} />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }, [isAgentConnected, voices, currentVoiceId, onSelectVoice, isVoiceChanging, pendingVoiceId]);

  return (
    <>
      <Header
        title={title}
        logo={logo}
        height={headerHeight}
        onConnectClicked={() =>
          onConnect(roomState === ConnectionState.Disconnected)
        }
      />
      <div
        className={`flex grow w-full selection:bg-cyan-900`}
        style={{ height: `calc(100% - ${headerHeight}px)` }}
      >
        <div className="flex-col grow basis-1/2 gap-4 h-full md:flex">
          <Tile
            title="ASSISTANT"
            className="w-full h-full grow"
            childrenClassName="justify-center"
          >
            {audioTileContent}
          </Tile>
        </div>
        <Tile
          padding={false}
          className={`h-full w-full basis-1/4 items-start overflow-y-auto hidden max-w-[480px] border-l border-white/20 ${
            showVoices ? "md:flex" : "md:hidden"
          }`}
          childrenClassName="h-full grow items-start"
        >
          {voiceSelectionPanel}
        </Tile>
        <div
          className={`bg-white/80 backdrop-blur-lg absolute w-full items-start transition-all duration-100 md:hidden ${
            showVoices ? "translate-x-0" : "translate-x-full"
          }`}
          style={{ height: `calc(100% - ${headerHeight}px)` }}
        >
          <div className="overflow-y-scroll h-full w-full">
            <div className="pb-32">{voiceSelectionPanel}</div>
          </div>
          <div className="pointer-events-none absolute z-10 bottom-0 w-full h-64 bg-gradient-to-t from-white to-transparent"></div>
        </div>
      </div>
    </>
  );
}
