<script lang="ts">
    import { onMount } from 'svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import { CheckCircle2 } from 'lucide-svelte';

    interface Props {
        videoBlob?: Blob | null;
        onbacktoeditor: () => void;
        onnewrecording: () => void;
    }

    let { videoBlob = null, onbacktoeditor, onnewrecording }: Props = $props();

    onMount(() => {
        if (!videoBlob) return;
        const url = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `screen-recording-${date}.mp4`;
        a.click();
        return () => URL.revokeObjectURL(url);
    });
</script>

<div class="flex h-full flex-col items-center justify-center gap-6 p-8">
    <CheckCircle2 class="size-12 text-green-500" />
    <div class="text-center">
        <p class="text-base font-medium">Download started</p>
        <p class="mt-1 text-sm text-muted-foreground">Your recording is saving as a .mp4 file</p>
    </div>
    <div class="flex gap-3">
        <Button variant="outline" onclick={onbacktoeditor}>Back to Editor</Button>
        <Button onclick={onnewrecording}>New Recording</Button>
    </div>
</div>
