<script lang="ts" module>
    import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
    import type { VariantProps } from 'tailwind-variants';

    import { cn, tv, type WithElementRef } from '$lib/utils.js';

    // YouDemo V2 buttons (docs/design/specs/foundations.md "Controls"): 1.5px ink
    // outline, a hard 0 4px 0 ink shadow and a 4px bottom margin that reserves it;
    // hover and press move 2px down onto 0 2px 0. Disabled is dashed, never faded.
    // Buttons use proportional figures, as the design's do (its `font` shorthand,
    // or the browser's own button font for links, resets them); a link's line
    // height is the browser's `normal`, not 1.5.
    export const buttonVariants = tv({
        base: 'mb-1 inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control border-[1.5px] border-solid border-yd-ink px-[18px] text-button font-semibold whitespace-nowrap normal-nums shadow-offset transition-[translate,box-shadow] duration-[120ms] outline-none select-none not-disabled:not-aria-disabled:hover:translate-y-0.5 not-disabled:not-aria-disabled:hover:shadow-offset-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yd-ink disabled:cursor-not-allowed disabled:border-dashed disabled:border-yd-muted disabled:bg-yd-base disabled:text-yd-muted disabled:shadow-none aria-disabled:cursor-not-allowed aria-disabled:border-dashed aria-disabled:border-yd-muted aria-disabled:bg-yd-base aria-disabled:text-yd-muted aria-disabled:shadow-none motion-reduce:transition-none',
        variants: {
            variant: {
                primary: 'bg-yd-accent text-yd-ink',
                ghost: 'bg-yd-card text-yd-ink',
                danger: 'bg-yd-danger text-yd-card',
                'danger-ghost': 'bg-yd-card text-yd-danger',
                link: 'mb-0 gap-1.5 leading-[normal] rounded-none border-0 bg-transparent px-0 text-yd-ink underline decoration-yd-accent decoration-[2.5px] underline-offset-4 shadow-none not-disabled:not-aria-disabled:hover:translate-y-0 not-disabled:not-aria-disabled:hover:shadow-none not-disabled:not-aria-disabled:hover:decoration-4 disabled:bg-transparent disabled:text-yd-ink aria-disabled:bg-transparent aria-disabled:text-yd-ink',
                // shadcn's own names, used by the generated primitives
                // (alert-dialog action and cancel)
                default: 'bg-yd-accent text-yd-ink',
                outline: 'bg-yd-card text-yd-ink'
            },
            size: {
                default: '',
                lg: 'min-h-13 px-6 text-body font-bold',
                icon: 'w-11 px-0',
                // The round restore button on a cut marker
                'icon-sm': 'size-[30px] min-h-[30px] rounded-full px-0 shadow-offset-press'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    });

    export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
    export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

    export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
        WithElementRef<HTMLAnchorAttributes> & {
            variant?: ButtonVariant;
            size?: ButtonSize;
        };
</script>

<script lang="ts">
    let {
        class: className,
        variant = 'default',
        size = 'default',
        ref = $bindable(null),
        href = undefined,
        type = 'button',
        disabled,
        children,
        ...restProps
    }: ButtonProps = $props();
</script>

{#if href}
    <a
        bind:this={ref}
        data-slot="button"
        class={cn(buttonVariants({ variant, size }), className)}
        href={disabled ? undefined : href}
        aria-disabled={disabled}
        role={disabled ? 'link' : undefined}
        tabindex={disabled ? -1 : undefined}
        {...restProps}
    >
        {@render children?.()}
    </a>
{:else}
    <button
        bind:this={ref}
        data-slot="button"
        class={cn(buttonVariants({ variant, size }), className)}
        {type}
        {disabled}
        {...restProps}
    >
        {@render children?.()}
    </button>
{/if}
