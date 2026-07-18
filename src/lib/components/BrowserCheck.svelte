<script lang="ts">
    import { CircleCheck, CircleX, TriangleAlert } from 'lucide-svelte';
    import { onMount } from 'svelte';

    import { Button } from '$lib/components/ui/button/index.js';
    import * as Card from '$lib/components/ui/card/index.js';
    import * as Empty from '$lib/components/ui/empty/index.js';

    import { cn } from '$lib/utils.js';

    let {
        onpass,
        hasScreenCapture = !!navigator.mediaDevices?.getDisplayMedia,
        hasMediaRecorder = typeof MediaRecorder !== 'undefined',
        hasCameraAccess = !!navigator.mediaDevices?.getUserMedia,
        hasAudioMixing = typeof AudioContext !== 'undefined' || 'webkitAudioContext' in window
    }: {
        onpass: () => void;
        hasScreenCapture?: boolean;
        hasMediaRecorder?: boolean;
        hasCameraAccess?: boolean;
        hasAudioMixing?: boolean;
    } = $props();

    const criticalPass = $derived(hasScreenCapture && hasMediaRecorder);
    const allPass = $derived(criticalPass && hasCameraAccess && hasAudioMixing);

    const checks = $derived<Array<{ label: string; ok: boolean; critical: boolean }>>([
        { label: 'Screen capture', ok: hasScreenCapture, critical: true },
        { label: 'Media recording', ok: hasMediaRecorder, critical: true },
        { label: 'Camera access', ok: hasCameraAccess, critical: false },
        { label: 'Audio mixing', ok: hasAudioMixing, critical: false }
    ]);

    onMount(() => {
        if (allPass) onpass();
    });
</script>

{#if !allPass}
    <div class="flex h-full items-center justify-center p-6">
        <Card.Root
            class={cn(
                'w-full max-w-md border-0 ring-2 ring-foreground/25 ring-offset-4 ring-offset-transparent'
            )}
        >
            {#if !criticalPass}
                <Empty.Root>
                    <Empty.Media>
                        <CircleX size={64} class="text-destructive" />
                    </Empty.Media>
                    <Empty.Header>
                        <Empty.Title>Browser not supported</Empty.Title>
                        <Empty.Description>
                            Required screen capture APIs are missing. Please use Chrome, Edge, or
                            Arc.
                        </Empty.Description>
                    </Empty.Header>
                </Empty.Root>
            {:else}
                <Empty.Root>
                    <Empty.Media>
                        <TriangleAlert size={64} class="text-amber-500" />
                    </Empty.Media>
                    <Empty.Header>
                        <Empty.Title>Limited support</Empty.Title>
                        <Empty.Description>
                            Update your browser for full features — camera and audio mixing are
                            unavailable.
                        </Empty.Description>
                    </Empty.Header>
                    <Empty.Content>
                        <Button
                            class="bg-indigo-500 text-white hover:bg-indigo-600"
                            onclick={onpass}
                            size="lg"
                        >
                            Continue anyway
                        </Button>
                    </Empty.Content>
                </Empty.Root>
            {/if}

            <ul class="mx-6 divide-y rounded-lg border">
                {#each checks as check (check.label)}
                    <li class="flex items-center gap-3 px-4 py-3">
                        {#if check.ok}
                            <CircleCheck class="size-8 shrink-0 text-indigo-500" />
                        {:else if check.critical}
                            <CircleX class="size-8 shrink-0 text-destructive" />
                        {:else}
                            <TriangleAlert class="size-8 shrink-0 text-amber-500" />
                        {/if}
                        <span class="text-sm">{check.label}</span>
                        {#if !check.critical}
                            <span class="ml-auto text-xs text-muted-foreground">optional</span>
                        {/if}
                    </li>
                {/each}
            </ul>
        </Card.Root>
    </div>
{/if}
