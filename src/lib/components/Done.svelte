<script lang="ts">
    import { CircleCheck } from 'lucide-svelte';
    import { onMount } from 'svelte';

    import { Button } from '$lib/components/ui/button/index.js';

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
        a.download = `yourdemo-${date}.webm`;
        a.click();
        return () => URL.revokeObjectURL(url);
    });
</script>

<div class="flex h-full flex-col items-center justify-center gap-6 p-8">
    <CircleCheck class="size-12 text-indigo-500" />
    <div class="text-center">
        <p class="text-base font-medium">Download started</p>
        <p class="mt-1 text-sm text-muted-foreground">Your recording is saving as a .webm file</p>
    </div>
    <div class="flex gap-3">
        <Button class="bg-indigo-500 text-white hover:bg-indigo-600" onclick={onbacktoeditor}
            >Back to Editor</Button
        >
        <Button class="border-indigo-500" onclick={onnewrecording}>New Recording</Button>
    </div>
</div>
