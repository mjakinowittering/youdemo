<script lang="ts">
    import type { Snippet } from 'svelte';

    import * as Tooltip from '$lib/components/ui/tooltip/index.js';

    let { children }: { children: Snippet } = $props();
</script>

<!-- A component board's sheet (docs/design/reference/components): 960 wide,
     24px padding on the base ground, states wrapped with an 18px gap -->
<Tooltip.Provider>
    <div data-compare="root" class="flex w-240 flex-wrap items-center gap-[18px] bg-yd-base p-6">
        {@render children()}
    </div>
</Tooltip.Provider>
