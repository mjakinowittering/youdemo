<script lang="ts">
    import { base } from '$app/paths';
    import { ChevronDown, CircleUserRound, UserRound } from 'lucide-svelte';
    import { untrack } from 'svelte';

    import { buttonVariants } from '$lib/components/ui/button/button.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    import {
        createBlurProcessor,
        type BlurIntensity,
        type BlurProcessor
    } from '$lib/blurProcessor.js';
    import { cn } from '$lib/utils.js';

    interface Props {
        rawStream: MediaStream | null;
        camEnabled: boolean;
        onProcessedStream: (stream: MediaStream | null) => void;
        onProcessorChange?: (processor: BlurProcessor | null) => void;
    }

    let { rawStream, camEnabled, onProcessedStream, onProcessorChange }: Props = $props();

    function getStoredIntensity(): BlurIntensity {
        try {
            const saved = localStorage.getItem('yourdemo-blur-intensity');
            if (saved === 'light' || saved === 'default' || saved === 'heavy') return saved;
        } catch {
            /* unavailable */
        }
        return 'default';
    }

    let blurOn = $state(false);
    let intensity = $state<BlurIntensity>(getStoredIntensity());
    let processor: BlurProcessor | null = null;
    let blurOnBeforeCamOff = false;

    $effect(() => {
        localStorage.setItem('yourdemo-blur-intensity', intensity);
    });

    // When cam is disabled, save blur state and turn off. Restore when re-enabled.
    $effect(() => {
        const enabled = camEnabled;
        if (!enabled) {
            const wasOn = untrack(() => blurOn);
            blurOnBeforeCamOff = wasOn;
            if (wasOn) toggleBlur();
        } else {
            const shouldRestore = blurOnBeforeCamOff;
            blurOnBeforeCamOff = false;
            if (shouldRestore) toggleBlur();
        }
    });

    async function toggleBlur() {
        if (blurOn) {
            processor?.destroy();
            processor = null;
            blurOn = false;
            onProcessedStream(null);
            onProcessorChange?.(null);
        } else {
            if (!rawStream) return;
            const p = await createBlurProcessor(rawStream, intensity, base);
            processor = p;
            blurOn = true;
            onProcessedStream(p.outputStream);
            onProcessorChange?.(p);
        }
    }

    function setIntensity(newIntensity: BlurIntensity) {
        intensity = newIntensity;
        processor?.setIntensity(newIntensity);
    }

    let tooltipText = $derived(
        !blurOn
            ? 'Background blur off'
            : intensity === 'light'
              ? 'Background blur — Light'
              : intensity === 'heavy'
                ? 'Background blur — Heavy'
                : 'Background blur'
    );
</script>

<Tooltip.Root>
    <Tooltip.Trigger>
        {#snippet child({ props })}
            <div {...props} class="flex">
                <Button
                    variant={!camEnabled ? 'destructive' : blurOn ? 'success' : 'outline'}
                    size="sm"
                    class="rounded-r-none border-r-0"
                    onclick={toggleBlur}
                    disabled={!camEnabled}
                    aria-label={blurOn ? 'Disable background blur' : 'Enable background blur'}
                >
                    {#if blurOn && camEnabled}
                        <CircleUserRound />
                    {:else}
                        <UserRound />
                    {/if}
                </Button>
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger
                        class={cn(
                            buttonVariants({
                                variant: !camEnabled
                                    ? 'destructive'
                                    : blurOn
                                      ? 'success'
                                      : 'outline',
                                size: 'sm'
                            }),
                            'rounded-l-none px-2'
                        )}
                        disabled={!camEnabled}
                        aria-label="Select blur intensity"
                    >
                        <ChevronDown class="size-3" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                        <DropdownMenu.RadioGroup
                            value={intensity}
                            onValueChange={(v) => setIntensity(v as BlurIntensity)}
                        >
                            <DropdownMenu.RadioItem value="light">Light</DropdownMenu.RadioItem>
                            <DropdownMenu.RadioItem value="default">Default</DropdownMenu.RadioItem>
                            <DropdownMenu.RadioItem value="heavy">Heavy</DropdownMenu.RadioItem>
                        </DropdownMenu.RadioGroup>
                    </DropdownMenu.Content>
                </DropdownMenu.Root>
            </div>
        {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>
        <p>{tooltipText}</p>
    </Tooltip.Content>
</Tooltip.Root>
