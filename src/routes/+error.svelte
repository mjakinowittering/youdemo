<script lang="ts">
    import { page } from '$app/state';
    import { MonitorPlay } from 'lucide-svelte';

    import { Button } from '$lib/components/ui/button';
    import * as Empty from '$lib/components/ui/empty/index.js';

    import { APP_NAME } from '$lib/titles.js';
</script>

<svelte:head>
    <title>{page.status} | {APP_NAME}</title>
</svelte:head>

<div class="flex h-full items-center justify-center">
    <Empty.Root>
        <Empty.Media>
            <MonitorPlay size={128} class="text-white" />
        </Empty.Media>
        <Empty.Header>
            <Empty.Title class="text-white">{page.status}</Empty.Title>
            <Empty.Description class="text-white/60">
                {page.status === 404
                    ? `Oops! Page not found. Sorry about that...`
                    : (page.error?.message ?? 'Something went wrong')}
            </Empty.Description>
        </Empty.Header>
        <Empty.Content>
            <Button href="/" class="bg-indigo-500 text-white hover:bg-indigo-600"
                >Back to YouDemo</Button
            >
        </Empty.Content>
    </Empty.Root>
</div>
