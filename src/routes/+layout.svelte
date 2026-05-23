<script lang="ts">
    import './layout.css';
    import favicon from '$lib/assets/favicon.svg';
    import { Sun, Moon, Keyboard } from 'lucide-svelte';
    import { Button } from '$lib/components/ui/button';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';
    import ShortcutsPanel from '$lib/components/ShortcutsPanel.svelte';

    let { children } = $props();

    let dark = $state((localStorage.getItem('theme') ?? 'dark') === 'dark');
    let shortcutsOpen = $state(false);

    $effect(() => {
        document.documentElement.classList.toggle('dark', dark);
        localStorage.setItem('theme', dark ? 'dark' : 'light');
    });

    function toggleTheme() {
        dark = !dark;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
            shortcutsOpen = !shortcutsOpen;
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<Tooltip.Provider>
    <div class="flex h-screen flex-col">
        <header class="flex h-14 items-center justify-between border-b px-4">
            <span class="text-sm font-semibold tracking-wide">ScreenCast</span>
            <div class="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Keyboard shortcuts"
                    onclick={() => (shortcutsOpen = true)}
                >
                    <Keyboard class="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onclick={toggleTheme} aria-label="Toggle theme">
                    {#if dark}
                        <Sun class="h-4 w-4" />
                    {:else}
                        <Moon class="h-4 w-4" />
                    {/if}
                </Button>
            </div>
        </header>

        <main class="flex-1 overflow-auto">
            {@render children()}
        </main>
    </div>
</Tooltip.Provider>

<ShortcutsPanel open={shortcutsOpen} onclose={() => (shortcutsOpen = false)} />
