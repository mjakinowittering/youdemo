<script lang="ts">
    import { onMount } from 'svelte';
    import * as Alert from '$lib/components/ui/alert/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-svelte';

    let { onpass }: { onpass: () => void } = $props();

    const hasScreenCapture = !!navigator.mediaDevices?.getDisplayMedia;
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const hasCameraAccess = !!navigator.mediaDevices?.getUserMedia;
    const hasAudioMixing = typeof AudioContext !== 'undefined' || 'webkitAudioContext' in window;

    const criticalPass = hasScreenCapture && hasMediaRecorder;
    const allPass = criticalPass && hasCameraAccess && hasAudioMixing;

    const checks: Array<{ label: string; ok: boolean; critical: boolean }> = [
        { label: 'Screen capture', ok: hasScreenCapture, critical: true },
        { label: 'Media recording', ok: hasMediaRecorder, critical: true },
        { label: 'Camera access', ok: hasCameraAccess, critical: false },
        { label: 'Audio mixing', ok: hasAudioMixing, critical: false }
    ];

    onMount(() => {
        if (allPass) onpass();
    });
</script>

{#if !allPass}
    <div class="flex h-full items-center justify-center p-6">
        <div class="w-full max-w-md space-y-4">
            {#if !criticalPass}
                <Alert.Root variant="destructive">
                    <XCircle class="size-4" />
                    <Alert.Title>Browser not supported</Alert.Title>
                    <Alert.Description>
                        Required screen capture APIs are missing. Please use Chrome, Edge, or Arc.
                    </Alert.Description>
                </Alert.Root>
            {:else}
                <Alert.Root class="border-amber-500/40 bg-amber-50/5 [&>svg]:text-amber-500">
                    <AlertTriangle class="size-4" />
                    <Alert.Title class="text-amber-700 dark:text-amber-400"
                        >Limited support</Alert.Title
                    >
                    <Alert.Description class="text-amber-600/80 dark:text-amber-500/80">
                        Update your browser for full features — camera and audio mixing are
                        unavailable.
                    </Alert.Description>
                </Alert.Root>
            {/if}

            <ul class="divide-y rounded-lg border">
                {#each checks as check (check.label)}
                    <li class="flex items-center gap-3 px-4 py-3">
                        {#if check.ok}
                            <CheckCircle2 class="size-4 shrink-0 text-green-500" />
                        {:else if check.critical}
                            <XCircle class="size-4 shrink-0 text-destructive" />
                        {:else}
                            <AlertTriangle class="size-4 shrink-0 text-amber-500" />
                        {/if}
                        <span class="text-sm">{check.label}</span>
                        {#if !check.critical}
                            <span class="ml-auto text-xs text-muted-foreground">optional</span>
                        {/if}
                    </li>
                {/each}
            </ul>

            {#if criticalPass}
                <Button class="w-full" onclick={onpass}>Continue anyway</Button>
            {/if}
        </div>
    </div>
{/if}
