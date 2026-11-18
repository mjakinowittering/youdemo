<script lang="ts">
    import type { IconSvgElement } from '@hugeicons/svelte';
    import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';

    import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

    import Icon from './Icon.svelte';

    interface Props {
        open?: boolean;
        title: string;
        body: string;
        /** Facts to check before confirming (Export: length, cuts, file). */
        details?: { label: string; value: string }[];
        /** The safe choice: first, and focused on open. */
        cancelLabel: string;
        confirmLabel: string;
        confirmIcon?: IconSvgElement;
        tone?: 'primary' | 'danger';
        onconfirm: () => void;
    }

    let {
        open = $bindable(false),
        title,
        body,
        details,
        cancelLabel,
        confirmLabel,
        confirmIcon,
        tone = 'primary',
        onconfirm
    }: Props = $props();
</script>

<!-- Rendered in place, absolutely over the app shell (which is positioned), like
     the drawn scrim. bits' `contain: layout` is lifted, as containment paints the
     panel on its own pixel grid, a pixel off the design's. -->
<AlertDialog.Root bind:open>
    <AlertDialog.Portal disabled>
        <AlertDialog.Overlay
            class="absolute z-10 bg-yd-scrim supports-backdrop-filter:backdrop-blur-none"
        />
        <!-- Centred by a full-screen grid, as drawn: a dialog taller than its frame
             starts at the top rather than off it -->
        <AlertDialogPrimitive.Content>
            {#snippet child({ props })}
                <div class="absolute inset-0 z-10 grid place-items-center">
                    <div
                        {...props}
                        data-section="dialog"
                        class="flex w-120 max-w-[calc(100%-48px)] flex-col gap-[18px] rounded-panel border-[1.5px] border-solid border-yd-ink bg-yd-card p-7 text-yd-ink shadow-panel contain-none! outline-none"
                    >
                        <AlertDialogPrimitive.Title level={2} class="text-dialog"
                            >{title}</AlertDialogPrimitive.Title
                        >
                        <AlertDialogPrimitive.Description class="text-body text-yd-muted">
                            {body}
                        </AlertDialogPrimitive.Description>
                        {#if details}
                            <dl
                                class="my-4 grid grid-cols-[auto_1fr] gap-x-[18px] gap-y-1.5 rounded-notice border-[1.5px] border-solid border-yd-ink bg-yd-base px-4 py-3.5"
                            >
                                {#each details as { label, value } (label)}
                                    <dt class="text-meta text-yd-muted uppercase">{label}</dt>
                                    <dd class="text-button font-semibold wrap-anywhere text-yd-ink">
                                        {value}
                                    </dd>
                                {/each}
                            </dl>
                        {/if}
                        <div class="flex items-center justify-end gap-3.5">
                            <AlertDialog.Cancel variant="ghost">{cancelLabel}</AlertDialog.Cancel>
                            <AlertDialog.Action
                                variant={tone}
                                onclick={() => {
                                    // bits' Action doesn't close the dialog itself
                                    open = false;
                                    onconfirm();
                                }}
                            >
                                {#if confirmIcon}<Icon icon={confirmIcon} />{/if}{confirmLabel}
                            </AlertDialog.Action>
                        </div>
                    </div>
                </div>
            {/snippet}
        </AlertDialogPrimitive.Content>
    </AlertDialog.Portal>
</AlertDialog.Root>
