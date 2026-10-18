<script lang="ts">
    import type { Snippet } from 'svelte';
    import type { HTMLAttributes } from 'svelte/elements';

    import { cn } from '$lib/utils.js';

    import AppHeader from './AppHeader.svelte';

    type Props = HTMLAttributes<HTMLDivElement> & { children: Snippet };

    let { class: className, children, ...rest }: Props = $props();
</script>

<!-- The header band over whichever screen is showing. Shared by the app layout
     and the visual stories' screen frame so both lay out alike. -->
<div class={cn('relative flex flex-col bg-yd-base', className)} {...rest}>
    <AppHeader />
    <main class="flex min-h-0 flex-1 flex-col overflow-auto">
        {@render children()}
    </main>
</div>
