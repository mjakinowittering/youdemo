<script lang="ts">
    import { CircleCheck } from 'lucide-svelte';
    import { onMount } from 'svelte';

    import { Button } from '$lib/components/ui/button/index.js';
    import * as Card from '$lib/components/ui/card/index.js';
    import * as Empty from '$lib/components/ui/empty/index.js';

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
        a.download = `youdemo-${date}.webm`;
        a.click();
        return () => URL.revokeObjectURL(url);
    });
</script>

<div class="flex h-full items-center justify-center bg-black/20">
    <Card.Root
        class="max-w-xl flex-1 items-center justify-center border-0 ring-2 ring-foreground/25 ring-offset-4 ring-offset-transparent"
    >
        <Empty.Root>
            <Empty.Media>
                <CircleCheck size={128} class="text-muted-foreground" />
            </Empty.Media>
            <Empty.Header>
                <Empty.Title>Download started</Empty.Title>
                <Empty.Description>Your recording is saved as a .webm file</Empty.Description>
            </Empty.Header>
            <Empty.Content>
                <div class="flex gap-3">
                    <Button
                        class="bg-indigo-500 text-white hover:bg-indigo-600"
                        onclick={onbacktoeditor}
                        size="lg"
                    >
                        Back to Editor
                    </Button>
                    <Button
                        variant="outline"
                        class="border-indigo-500"
                        onclick={onnewrecording}
                        size="lg"
                    >
                        New Recording
                    </Button>
                </div>
            </Empty.Content>
        </Empty.Root>
    </Card.Root>
</div>
