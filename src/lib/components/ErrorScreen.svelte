<script lang="ts">
    import {
        Alert02Icon,
        Copy01Icon,
        RefreshIcon,
        SecurityCheckIcon
    } from '@hugeicons/core-free-icons';

    import TechnicalDetails from '$lib/components/TechnicalDetails.svelte';
    import { Button } from '$lib/components/ui/button/index.js';

    import Icon from './Icon.svelte';
    import Notice from './Notice.svelte';

    interface Props {
        /** What went wrong, in words. */
        reason: string;
        /** The error and its stack, under Technical details and for Copy error. */
        details: string;
        /** The crash store holds takes, so a reload brings them back. */
        recordingSafe?: boolean;
    }

    let { reason, details, recordingSafe = false }: Props = $props();
</script>

<section data-section="stage" class="relative flex min-h-0 flex-1 bg-yd-sand">
    <div class="m-auto flex w-150 flex-col gap-[22px]">
        <Icon icon={Alert02Icon} size={48} class="text-yd-danger" />
        <h1 class="text-screen text-balance">Something went wrong</h1>
        <p class="text-lead text-yd-muted">{reason}</p>
        {#if recordingSafe}
            <Notice icon={SecurityCheckIcon} title="Your recording is safe">
                Every take is saved in this browser as you record. Reload and YouDemo opens it in
                the editor.
            </Notice>
        {/if}
        <div class="flex items-center gap-3.5">
            <Button variant="primary" size="lg" onclick={() => location.reload()}>
                <Icon icon={RefreshIcon} />Reload YouDemo
            </Button>
            <Button
                variant="ghost"
                size="lg"
                onclick={() => navigator.clipboard?.writeText(details)}
            >
                <Icon icon={Copy01Icon} />Copy error
            </Button>
        </div>
        <TechnicalDetails
            {details}
            class="rounded-card border-[1.5px] border-solid border-yd-ink bg-yd-card px-[18px] py-3.5"
        />
    </div>
</section>
