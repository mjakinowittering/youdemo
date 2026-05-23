<script lang="ts">
    import { fade, scale } from 'svelte/transition';
    import { Button } from '$lib/components/ui/button/index.js';
    import { X } from 'lucide-svelte';

    interface Props {
        open?: boolean;
        onclose: () => void;
    }

    let { open = false, onclose }: Props = $props();

    const editorShortcuts: { keys: string[]; label: string }[] = [
        { keys: ['Space'], label: 'Play / pause' },
        { keys: ['←', '→'], label: 'Step back / forward 5s' },
        { keys: ['C'], label: 'Add cut at playhead' },
        { keys: ['⌘', 'E'], label: 'Export & download' },
        { keys: ['Del'], label: 'Remove selected cut' }
    ];

    const generalShortcuts: { keys: string[]; label: string }[] = [
        { keys: ['?'], label: 'Open this panel' }
    ];

    function onBackdropClick() {
        onclose();
    }
    function onBackdropKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') onclose();
    }
    function onDialogKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') onclose();
        e.stopPropagation();
    }
</script>

{#if open}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        role="presentation"
        transition:fade={{ duration: 150 }}
        onclick={onBackdropClick}
        onkeydown={onBackdropKeydown}
    >
        <div
            class="relative w-full max-w-md rounded-xl bg-card p-6 text-card-foreground shadow-xl ring-1 ring-foreground/10"
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            tabindex="-1"
            transition:scale={{ duration: 150, start: 0.95 }}
            onclick={(e) => e.stopPropagation()}
            onkeydown={onDialogKeydown}
        >
            <div class="mb-5 flex items-center justify-between">
                <h2 class="text-base font-semibold">Keyboard Shortcuts</h2>
                <Button variant="ghost" size="icon" onclick={onclose}>
                    <X class="size-4" />
                </Button>
            </div>

            <div class="space-y-5">
                <section>
                    <h3
                        class="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                    >
                        Editor
                    </h3>
                    <div class="divide-y rounded-lg border">
                        {#each editorShortcuts as { keys, label } (label)}
                            <div class="flex items-center justify-between px-3 py-2 text-sm">
                                <span>{label}</span>
                                <span class="flex items-center gap-1">
                                    {#each keys as key, i (i)}
                                        <kbd
                                            class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs leading-none"
                                            >{key}</kbd
                                        >
                                    {/each}
                                </span>
                            </div>
                        {/each}
                    </div>
                </section>

                <section>
                    <h3
                        class="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                    >
                        General
                    </h3>
                    <div class="divide-y rounded-lg border">
                        {#each generalShortcuts as { keys, label } (label)}
                            <div class="flex items-center justify-between px-3 py-2 text-sm">
                                <span>{label}</span>
                                <span class="flex items-center gap-1">
                                    {#each keys as key, i (i)}
                                        <kbd
                                            class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs leading-none"
                                            >{key}</kbd
                                        >
                                    {/each}
                                </span>
                            </div>
                        {/each}
                    </div>
                </section>
            </div>
        </div>
    </div>
{/if}
