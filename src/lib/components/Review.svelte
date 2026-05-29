<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';

    interface Props {
        onresume: () => void;
        onedit: () => void;
        ondiscard: () => void;
        duration?: number;
        micEnabled?: boolean;
        camEnabled?: boolean;
        videoUrl?: string | null;
    }

    let {
        onresume,
        onedit,
        ondiscard,
        duration = 0,
        micEnabled = true,
        camEnabled = false,
        videoUrl = null
    }: Props = $props();

    let formattedDuration = $derived(
        `${Math.floor(duration / 60)
            .toString()
            .padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`
    );

    function seekToEnd(node: HTMLVideoElement) {
        function onloaded() {
            if (node.duration && isFinite(node.duration)) {
                node.currentTime = node.duration;
            }
        }
        node.addEventListener('loadedmetadata', onloaded);
        return () => node.removeEventListener('loadedmetadata', onloaded);
    }
</script>

<div class="relative flex h-full flex-col items-center justify-center">
    <div class="absolute inset-0">
        {#if videoUrl}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video src={videoUrl} class="h-full w-full object-contain grayscale" {@attach seekToEnd}
            ></video>
        {:else}
            <div class="h-full w-full bg-black/30"></div>
        {/if}
    </div>

    <div class="relative flex w-full max-w-3xl flex-col items-center gap-4 px-6 py-8">
        <div class="flex items-center gap-2">
            <Badge variant="secondary">{formattedDuration}</Badge>
            <Badge variant="secondary">{micEnabled ? 'Mic on' : 'Mic off'}</Badge>
            <Badge variant="secondary">{camEnabled ? 'Cam on' : 'No cam'}</Badge>
        </div>

        <div class="flex w-full gap-4">
            <button
                type="button"
                onclick={onresume}
                class="flex flex-1 cursor-pointer flex-col gap-2 rounded-xl bg-card p-6 text-left text-card-foreground shadow-sm ring-2 ring-indigo-500 transition-colors hover:bg-muted/50"
            >
                <span class="text-sm font-semibold">Resume</span>
                <span class="text-xs text-muted-foreground">Continue with a new segment</span>
            </button>

            <button
                type="button"
                onclick={onedit}
                class="flex flex-1 cursor-pointer flex-col gap-2 rounded-xl bg-card p-6 text-left text-card-foreground shadow-sm ring-2 ring-indigo-500 transition-colors hover:bg-muted/50"
            >
                <span class="text-sm font-semibold">Edit & Export</span>
                <span class="text-xs text-muted-foreground">Trim, cut, and export to MP4</span>
            </button>

            <button
                type="button"
                onclick={ondiscard}
                class="text-destructive-foreground flex flex-1 cursor-pointer flex-col gap-2 rounded-xl bg-destructive p-6 text-left shadow-sm ring-1 ring-destructive/20 transition-colors hover:bg-destructive/90"
            >
                <span class="text-sm font-semibold">Discard</span>
                <span class="text-destructive-foreground/70 text-xs">Delete this recording</span>
            </button>
        </div>
    </div>
</div>
