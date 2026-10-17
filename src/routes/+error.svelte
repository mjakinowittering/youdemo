<script lang="ts">
    import { resolve } from '$app/paths';
    import { page } from '$app/state';

    import { Button } from '$lib/components/ui/button';

    import { APP_NAME } from '$lib/titles.js';
</script>

<svelte:head>
    <title>{page.status} | {APP_NAME}</title>
</svelte:head>

<div class="flex h-full flex-col items-center justify-center gap-4 bg-yd-sand p-6 text-center">
    <h1 class="text-screen text-yd-ink">{page.status}</h1>
    <p class="text-lead text-yd-muted">
        {page.status === 404
            ? `Oops! Page not found. Sorry about that...`
            : (page.error?.message ?? 'Something went wrong')}
    </p>
    <Button href={resolve('/')}>Back to YouDemo</Button>
</div>
