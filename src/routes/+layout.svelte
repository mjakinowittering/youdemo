<script lang="ts">
    import './layout.css';

    import { MonitorPlay, Moon, Sun } from 'lucide-svelte';

    import { Button } from '$lib/components/ui/button';
    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    import favicon from '$lib/assets/favicon.svg';

    let { children } = $props();

    let dark = $state((localStorage.getItem('theme') ?? 'dark') === 'dark');

    $effect(() => {
        document.documentElement.classList.toggle('dark', dark);
        localStorage.setItem('theme', dark ? 'dark' : 'light');
    });

    function toggleTheme() {
        dark = !dark;
    }
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<Tooltip.Provider>
    <div class="flex h-screen flex-col">
        <header class="flex h-14 items-center justify-between border-b px-4">
            <span class="flex items-center text-sm font-semibold tracking-wide">
                <MonitorPlay class="mr-2 text-indigo-500" size={20} />
                YourDemo
            </span>
            <div class="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    class="hover:text-indigo-500"
                    onclick={toggleTheme}
                    aria-label="Toggle theme"
                >
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
