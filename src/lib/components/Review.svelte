<script lang="ts">
    import { Clapperboard, Film, Trash2 } from 'lucide-svelte';

    import ControlBar from '$lib/components/ControlBar.svelte';
    import { buttonVariants, type ButtonVariant } from '$lib/components/ui/button/button.svelte';
    import * as Card from '$lib/components/ui/card/index.js';

    import type { BlurIntensity } from '$lib/blurProcessor.js';
    import { cn } from '$lib/utils.js';

    interface Props {
        onresume: () => void;
        onedit: () => void;
        ondiscard: () => void;
        micMuted?: boolean;
        camEnabled?: boolean;
        blurOn?: boolean;
        blurIntensity?: BlurIntensity;
    }

    let {
        onresume,
        onedit,
        ondiscard,
        micMuted = $bindable(false),
        camEnabled = $bindable(true),
        blurOn = $bindable(false),
        blurIntensity = $bindable<BlurIntensity>('default')
    }: Props = $props();
</script>

<!-- The whole card is the click target — onclick lives on Card.Root, so the
     footer button is purely visual (pointer-events-none). This avoids the
     stretched-overlay/stacking issues of a clickable child inside the card. -->
{#snippet actionCard(
    Icon: typeof Clapperboard,
    title: string,
    description: string,
    label: string,
    variant: ButtonVariant,
    onclick: () => void
)}
    {@const destructive = variant === 'destructive'}
    <Card.Root
        role="button"
        tabindex={0}
        {onclick}
        onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onclick();
            }
        }}
        class={cn(
            'flex-1 cursor-pointer border-0 ring-2 ring-foreground/25 ring-offset-4 ring-offset-transparent transition-colors focus-visible:outline-none',
            destructive
                ? 'hover:ring-destructive focus-visible:ring-destructive'
                : 'hover:ring-indigo-500 focus-visible:ring-indigo-500'
        )}
    >
        <Card.Header>
            <Icon class={cn('mb-2 size-8', destructive ? 'text-destructive' : 'text-indigo-500')} />
            <Card.Title>{title}</Card.Title>
            <Card.Description>{description}</Card.Description>
        </Card.Header>
        <Card.Footer>
            <div
                class={cn(
                    buttonVariants({ variant, size: 'default' }),
                    'pointer-events-none w-full'
                )}
            >
                {label}
            </div>
        </Card.Footer>
    </Card.Root>
{/snippet}

<div class="flex h-full flex-col bg-black/20">
    <div class="flex flex-1 items-center justify-center overflow-auto p-6">
        <div class="flex w-full max-w-3xl flex-col gap-4 sm:flex-row">
            {@render actionCard(
                Clapperboard,
                'Resume recording',
                'Continue capturing another segment',
                'Continue',
                'outline',
                onresume
            )}
            {@render actionCard(
                Film,
                'Edit recording',
                'Trim and export your recording',
                'Continue',
                'outline',
                onedit
            )}
            {@render actionCard(
                Trash2,
                'Discard recording',
                'Delete this recording and start over',
                'Discard',
                'destructive',
                ondiscard
            )}
        </div>
    </div>

    <ControlBar bind:micMuted bind:camEnabled bind:blurOn bind:blurIntensity disabled={true} />
</div>
