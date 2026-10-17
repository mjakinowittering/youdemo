<script lang="ts">
    import {
        CheckmarkCircle02Icon,
        Delete02Icon,
        Download04Icon,
        PlayIcon,
        PlusSignIcon
    } from '@hugeicons/core-free-icons';
    import type { Snippet } from 'svelte';

    import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
    import Icon from '$lib/components/Icon.svelte';
    import Notice from '$lib/components/Notice.svelte';
    import ProgressCard from '$lib/components/ProgressCard.svelte';
    import SkeletonBlock from '$lib/components/SkeletonBlock.svelte';
    import { Button } from '$lib/components/ui/button/index.js';

    import type { StripItem } from '$lib/editorMath.js';
    import type { EditorPhase } from '$lib/types.js';

    import EditorBreadcrumb from './EditorBreadcrumb.svelte';
    import EditorFooter from './EditorFooter.svelte';
    import EditorToolbar from './EditorToolbar.svelte';
    import ExportFailedCard from './ExportFailedCard.svelte';
    import FrameStrip from './FrameStrip.svelte';
    import OverviewBar from './OverviewBar.svelte';
    import Scrubber from './Scrubber.svelte';
    import TimelineLabels from './TimelineLabels.svelte';
    import VideoFrame from './VideoFrame.svelte';

    /**
     * The Editor screen as drawn: every value it shows comes in as a prop
     * (Editor.svelte works them out from editorMath), so a story can render any
     * phase with the boards' numbers.
     */
    interface Props {
        phase: EditorPhase;
        /** Joining or exporting, 0–100. */
        progress?: number;
        /** "Joining 2 takes" */
        joiningTitle?: string;
        /** "Applying your cut. …" */
        exportingNote?: string;
        /** The file just saved: shows the Exported notice. */
        exportedFile?: string | null;
        /** Export failed: why, and the technical details. */
        failure?: { reason: string; details: string } | null;
        /** The video (or a stand-in) inside its frame. */
        video: Snippet;
        /** The video's width ÷ height; null keeps the drawn 533:300. */
        videoAspect?: number | null;

        paused: boolean;
        time: string;
        percent: number;
        trimming: boolean;
        canUndo: boolean;
        canRedo: boolean;
        zoomLabel: string;
        canZoomIn: boolean;
        canZoomOut: boolean;
        selection: string;
        overview: { windowStart: number; windowWidth: number; cuts: number[]; playhead: number };
        strip: StripItem[];
        stripLeading?: number;
        stripOffset?: number;
        /** The strip's visible width, measured. */
        stripWidth?: number;
        labels: { start: string; middle?: string; end: string };

        exportOpen?: boolean;
        discardOpen?: boolean;
        newRecordingOpen?: boolean;
        /** For the Export dialog. */
        exportDetails: { label: string; value: string }[];
        /** For the Discard and New recording dialogs. */
        discardBody: string;

        onback: () => void;
        ontoggleplay: () => void;
        onseek: (percent: number) => void;
        ontoggletrim: () => void;
        onundo: () => void;
        onredo: () => void;
        onzoomin: () => void;
        onzoomout: () => void;
        onremove: () => void;
        onpanto: (fraction: number) => void;
        onpanby: (delta: number) => void;
        onframeclick: (cell: number) => void;
        onrestore: (cut: number) => void;
        ondismissexported: () => void;
        onretry: () => void;
        onconfirmexport: () => void;
        onconfirmdiscard: () => void;
        onconfirmnewrecording: () => void;
    }

    let {
        phase,
        progress = 0,
        joiningTitle = '',
        exportingNote = '',
        exportedFile = null,
        failure = null,
        video,
        videoAspect = null,
        paused,
        time,
        percent,
        trimming,
        canUndo,
        canRedo,
        zoomLabel,
        canZoomIn,
        canZoomOut,
        selection,
        overview,
        strip,
        stripLeading = 0,
        stripOffset = 0,
        stripWidth = $bindable(0),
        labels,
        exportOpen = $bindable(false),
        discardOpen = $bindable(false),
        newRecordingOpen = $bindable(false),
        exportDetails,
        discardBody,
        onback,
        ontoggleplay,
        onseek,
        ontoggletrim,
        onundo,
        onredo,
        onzoomin,
        onzoomout,
        onremove,
        onpanto,
        onpanby,
        onframeclick,
        onrestore,
        ondismissexported,
        onretry,
        onconfirmexport,
        onconfirmdiscard,
        onconfirmnewrecording
    }: Props = $props();

    let joining = $derived(phase === 'joining');
    let exporting = $derived(phase === 'exporting');
    // Skeleton frames enough to fill the strip, as drawn
    let skeletonCells = $derived(Math.max(0, Math.floor((stripWidth - 24) / 83)));
</script>

<div class="flex min-h-0 flex-1 flex-col">
    <EditorBreadcrumb
        class="border-b-[1.5px] border-solid border-yd-ink"
        disabled={joining || exporting}
        {trimming}
        {onback}
        onnewrecording={() => (newRecordingOpen = true)}
    />

    <section
        data-section="stage"
        class="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-yd-sand"
    >
        {#if joining}
            <ProgressCard
                title={joiningTitle}
                {progress}
                note="The timeline fills in once they're joined."
            />
        {:else if exporting}
            <ProgressCard title="Exporting" {progress} note={exportingNote} />
        {:else if phase === 'failed' && failure}
            <ExportFailedCard reason={failure.reason} details={failure.details} {onretry} />
        {:else if exportedFile}
            <div class="mx-6 self-stretch">
                <Notice icon={CheckmarkCircle02Icon} ondismiss={ondismissexported}>
                    <b>Exported.</b> Saved {exportedFile} to your downloads.
                </Notice>
            </div>
        {/if}
        <!-- Stays mounted while a card covers it, so playback keeps its place -->
        <VideoFrame
            class={joining || exporting || phase === 'failed' ? 'hidden' : ''}
            aspect={videoAspect}
        >
            {@render video()}
        </VideoFrame>
    </section>

    <section
        data-section="timeline"
        aria-label="Timeline"
        class="flex shrink-0 flex-col border-t-[1.5px] border-solid border-yd-ink bg-yd-base"
    >
        {#if joining}
            <div class="flex items-center gap-3.5 px-6 pt-3">
                <Button variant="ghost" size="icon" disabled aria-label="Play">
                    <Icon icon={PlayIcon} />
                </Button>
                <span class="min-w-[110px] text-small font-semibold text-yd-ink">--:-- / --:--</span
                >
                <SkeletonBlock class="h-3 flex-1 rounded-full" />
            </div>
            <div class="flex items-center gap-3.5 px-6 py-3">
                <SkeletonBlock class="h-11 w-[110px]" />
                <SkeletonBlock class="size-11" />
                <SkeletonBlock class="size-11" />
                <span class="flex-1"></span>
                <SkeletonBlock class="h-11 w-[150px]" />
            </div>
            <div class="px-6"><SkeletonBlock class="h-8" /></div>
            <div class="overflow-hidden" bind:clientWidth={stripWidth}>
                <div class="flex gap-[3px] pt-[30px] pl-6">
                    {#each { length: skeletonCells } as _, i (i)}
                        <SkeletonBlock
                            class="h-16 w-20 rounded-frame border-[1.5px] border-solid border-yd-rule"
                        />
                    {/each}
                </div>
            </div>
            <div class="flex items-center gap-3.5 px-6 pt-2.5 pb-3.5">
                <SkeletonBlock class="h-3.5 w-11" />
                <span class="flex-1"></span>
                <SkeletonBlock class="h-3.5 w-11" />
            </div>
        {:else}
            <Scrubber
                class="px-6 pt-3"
                {paused}
                {time}
                {percent}
                disabled={exporting}
                {ontoggleplay}
                {onseek}
            />
            <EditorToolbar
                class="px-6 py-3"
                {trimming}
                {canUndo}
                {canRedo}
                {zoomLabel}
                {canZoomIn}
                {canZoomOut}
                {selection}
                disabled={exporting}
                {ontoggletrim}
                {onundo}
                {onredo}
                {onzoomin}
                {onzoomout}
                {onremove}
            />
            <div class="px-6">
                <OverviewBar {...overview} disabled={exporting} onpan={onpanto} />
            </div>
            <div class="overflow-hidden" bind:clientWidth={stripWidth}>
                <FrameStrip
                    class="pt-[30px] pl-6"
                    items={strip}
                    leading={stripLeading}
                    offset={stripOffset}
                    {onframeclick}
                    {onrestore}
                    onpan={onpanby}
                />
            </div>
            <TimelineLabels class="px-6 pt-1.5 pb-3" {...labels} />
        {/if}
    </section>

    <EditorFooter
        {trimming}
        disabled={joining || exporting}
        preparing={joining}
        ondiscard={() => (discardOpen = true)}
        onexport={() => (exportOpen = true)}
        ondonetrimming={ontoggletrim}
    />
</div>

<ConfirmDialog
    bind:open={exportOpen}
    title="Export your video?"
    body="YouDemo saves it to your downloads as a .webm file. Your cuts stay here, so you can export again."
    details={exportDetails}
    cancelLabel="Cancel"
    confirmLabel="Export"
    confirmIcon={Download04Icon}
    onconfirm={onconfirmexport}
/>
<ConfirmDialog
    bind:open={discardOpen}
    title="Discard this recording?"
    body={discardBody}
    cancelLabel="Keep editing"
    confirmLabel="Discard"
    confirmIcon={Delete02Icon}
    tone="danger"
    onconfirm={onconfirmdiscard}
/>
<ConfirmDialog
    bind:open={newRecordingOpen}
    title="Start a new recording?"
    body={discardBody}
    cancelLabel="Keep editing"
    confirmLabel="Start new"
    confirmIcon={PlusSignIcon}
    tone="danger"
    onconfirm={onconfirmnewrecording}
/>
