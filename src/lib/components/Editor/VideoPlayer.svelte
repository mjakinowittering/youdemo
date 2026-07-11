<script lang="ts">
    import { Pause, Play } from 'lucide-svelte';

    import { resolveSeekTarget } from '$lib/editorMath.js';
    import type { DeletedRange } from '$lib/types.js';

    interface Props {
        videoUrl?: string | null;
        deletedRanges?: DeletedRange[];
        paused?: boolean;
        currentTime?: number;
        duration?: number;
    }

    let {
        videoUrl = null,
        deletedRanges = [],
        paused = $bindable(true),
        currentTime = $bindable(0),
        duration = $bindable(0)
    }: Props = $props();

    let videoEl = $state<HTMLVideoElement | undefined>(undefined);
    let showPlayIcon = $state(false);
    let showPauseIcon = $state(false);

    function handleVideoClick() {
        if (!videoEl) return;
        if (paused) {
            showPlayIcon = true;
            paused = false;
        } else {
            showPauseIcon = true;
            paused = true;
        }
        setTimeout(() => {
            showPlayIcon = false;
            showPauseIcon = false;
        }, 600);
    }

    // Skip over deleted spans during playback. Uses `resolveSeekTarget` (pure) to
    // find the kept frame after the span, then drives the element directly.
    function handleTimeUpdate() {
        if (!videoEl || deletedRanges.length === 0) return;

        const pos = videoEl.currentTime;
        const dur = videoEl.duration;
        if (!isFinite(dur) || dur === 0) return;

        const jumpTo = resolveSeekTarget(pos, deletedRanges);
        if (jumpTo === pos) return;

        if (jumpTo >= dur) {
            videoEl.pause();
            // Park just before the span that runs to the end.
            const range = deletedRanges.find((r) => pos >= r.startTime && pos < r.endTime);
            videoEl.currentTime = Math.max(0, (range?.startTime ?? pos) - 0.001);
            return;
        }

        requestAnimationFrame(() => {
            if (videoEl && Math.abs(videoEl.currentTime - pos) < 0.1) {
                videoEl.currentTime = jumpTo;
            }
        });
    }

    $effect(() => {
        if (!videoEl) return;
        videoEl.addEventListener('timeupdate', handleTimeUpdate);
        return () => {
            videoEl?.removeEventListener('timeupdate', handleTimeUpdate);
        };
    });
</script>

<div class="relative min-h-0 flex-1">
    {#if videoUrl}
        <div
            class="relative h-full cursor-pointer"
            onclick={handleVideoClick}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleVideoClick();
                }
            }}
            aria-label="Toggle play/pause"
        >
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
                bind:this={videoEl}
                src={videoUrl}
                bind:paused
                bind:currentTime
                bind:duration
                class="h-full w-full object-contain"
            ></video>
            {#if showPlayIcon || showPauseIcon}
                <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div class="animate-ping-once text-indigo-500">
                        {#if showPlayIcon}
                            <Play size={96} fill="currentColor" />
                        {:else}
                            <Pause size={96} fill="currentColor" />
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
    {:else}
        <div class="flex h-full items-center justify-center text-sm text-muted-foreground">
            No video loaded
        </div>
    {/if}
</div>
