"use client";

import { useRef, useState, useEffect } from "react";

interface AudioPlayerProps {
    src: string;
}

export function AudioPlayer({ src }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onTimeUpdate = () => setCurrent(audio.currentTime);
        const onDuration = () => setDuration(audio.duration);
        const onEnded = () => setIsPlaying(false);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("loadedmetadata", onDuration);
        audio.addEventListener("ended", onEnded);
        return () => {
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("loadedmetadata", onDuration);
            audio.removeEventListener("ended", onEnded);
        };
    }, []);

    function fmt(s: number) {
        if (!s || isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, "0")}`;
    }

    function togglePlay() {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) { audio.pause(); setIsPlaying(false); }
        else { audio.play(); setIsPlaying(true); }
    }

    function seek(e: React.ChangeEvent<HTMLInputElement>) {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = Number(e.target.value);
    }

    const pct = duration ? (current / duration) * 100 : 0;

    useEffect(() => {
        if (progressRef.current) {
            progressRef.current.style.width = `${pct}%`;
        }
    }, [pct]);

    return (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 min-w-[220px] max-w-[260px]">
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Play/Pause */}
            <button
                onClick={togglePlay}
                className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary hover:bg-primary/90 transition text-primary-foreground shadow-sm"
            >
                {isPlaying ? (
                    <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                    </svg>
                ) : (
                    <svg className="h-2.5 w-2.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <polygon points="5,3 19,12 5,21" />
                    </svg>
                )}
            </button>

            {/* Time */}
            <span className="flex-shrink-0 text-[10px] text-muted-foreground/60 font-mono tabular-nums">
                {fmt(current)}&nbsp;/&nbsp;{fmt(duration)}
            </span>

            {/* Progress bar */}
            <div className="relative flex-1 h-1 rounded-full bg-border">
                <div
                    ref={progressRef}
                    className="absolute inset-y-0 left-0 rounded-full bg-primary"
                />
                <input
                    type="range"
                    title="Progreso de audio"
                    aria-label="Progreso de audio"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={current}
                    onChange={seek}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                />
            </div>

            {/* Download */}
            <a
                href={src}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-muted-foreground/40 hover:text-primary transition"
                title="Descargar"
                onClick={(e) => e.stopPropagation()}
            >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </a>
        </div>
    );
}
