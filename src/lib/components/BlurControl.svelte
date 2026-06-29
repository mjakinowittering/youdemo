<script lang="ts">
    import { ChevronDown, CircleUserRound, UserRound } from 'lucide-svelte';

    import { buttonVariants, type ButtonVariant } from '$lib/components/ui/button/button.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    import type { BlurIntensity } from '$lib/blurProcessor.js';
    import { cn } from '$lib/utils.js';

    interface Props {
        blurOn?: boolean;
        intensity?: BlurIntensity;
        camEnabled?: boolean;
        disabled?: boolean;
    }

    let {
        blurOn = $bindable(false),
        intensity = $bindable<BlurIntensity>('default'),
        camEnabled = false,
        disabled = false
    }: Props = $props();

    let blurDisabled = $derived(disabled || !camEnabled);

    let variant = $derived<ButtonVariant>(
        !camEnabled ? 'destructive' : blurOn ? 'success' : 'outline'
    );

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
                    {variant}
                    size="lg"
                    class="rounded-r-none border-r-0"
                    onclick={() => (blurOn = !blurOn)}
                    disabled={blurDisabled}
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
                        class={cn(buttonVariants({ variant, size: 'lg' }), 'rounded-l-none px-2')}
                        disabled={blurDisabled}
                        aria-label="Select blur intensity"
                    >
                        <ChevronDown class="size-3" />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                        <DropdownMenu.RadioGroup
                            value={intensity}
                            onValueChange={(v) => (intensity = v as BlurIntensity)}
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
