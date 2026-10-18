<script module lang="ts">
    import {
        ArrowLeft01Icon,
        CheckmarkCircle02Icon,
        ComputerScreenShareIcon,
        Delete02Icon,
        Download04Icon,
        Move01Icon,
        RecordIcon,
        RedoIcon,
        SecurityCheckIcon,
        StopIcon,
        VideoReplayIcon
    } from '@hugeicons/core-free-icons';
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import { DropdownMenu as DropdownMenuPrimitive, Tooltip as TooltipPrimitive } from 'bits-ui';

    import AppHeader from '$lib/components/AppHeader.svelte';
    import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
    import EditorBreadcrumb from '$lib/components/Editor/EditorBreadcrumb.svelte';
    import EditorToolbar from '$lib/components/Editor/EditorToolbar.svelte';
    import FrameStrip from '$lib/components/Editor/FrameStrip.svelte';
    import OverviewBar from '$lib/components/Editor/OverviewBar.svelte';
    import TimelineLabels from '$lib/components/Editor/TimelineLabels.svelte';
    import Icon from '$lib/components/Icon.svelte';
    import ListCard from '$lib/components/ListCard.svelte';
    import MenuOptions from '$lib/components/MenuOptions.svelte';
    import Notice from '$lib/components/Notice.svelte';
    import Pill from '$lib/components/Pill.svelte';
    import ProgressBar from '$lib/components/ProgressBar.svelte';
    import ProgressCard from '$lib/components/ProgressCard.svelte';
    import CaptureDock from '$lib/components/Recorder/CaptureDock.svelte';
    import WebcamBubble from '$lib/components/Recorder/WebcamBubble.svelte';
    import WebcamBubbleFace from '$lib/components/Recorder/WebcamBubbleFace.svelte';
    import SkeletonBlock from '$lib/components/SkeletonBlock.svelte';
    import StatusList from '$lib/components/StatusList.svelte';
    import { menuClass, tooltipClass } from '$lib/components/styles.js';
    import { Button } from '$lib/components/ui/button/index.js';

    import { fixtureStrip } from './fixtures.js';
    import Sheet from './Sheet.svelte';

    // Each story renders the sheet of states on its board in
    // docs/design/reference/components, for `npm run compare`.
    const { Story } = defineMeta({
        title: 'Visual/Components',
        parameters: { layout: 'fullscreen' }
    });
</script>

<Story name="AppHeader">
    {#snippet template()}
        <Sheet>
            <div class="w-full overflow-hidden rounded-control border-[1.5px] border-yd-ink">
                <AppHeader />
            </div>
        </Sheet>
    {/snippet}
</Story>

<Story name="Button">
    {#snippet template()}
        <Sheet>
            <Button variant="primary" size="lg">
                <Icon icon={ComputerScreenShareIcon} />Choose what to share
            </Button>
            <Button variant="ghost"><Icon icon={RecordIcon} />Record another take</Button>
            <Button variant="danger"><Icon icon={StopIcon} />Stop recording</Button>
            <Button variant="danger-ghost"><Icon icon={Delete02Icon} />Discard</Button>
            <Button variant="ghost" size="icon" aria-label="Redo"><Icon icon={RedoIcon} /></Button>
            <Button variant="ghost" disabled><Icon icon={Download04Icon} />Export</Button>
            <Button variant="link"><Icon icon={ArrowLeft01Icon} size={18} />Back to review</Button>
        </Sheet>
    {/snippet}
</Story>

<Story name="Pill">
    {#snippet template()}
        <Sheet>
            <Pill>First time here</Pill>
            <Pill variant="sand">Browser check</Pill>
            <Pill variant="on">Available</Pill>
            <Pill variant="off">Not available</Pill>
            <Pill variant="rec">REC<span class="tracking-normal">01:12</span></Pill>
            <Pill><Icon icon={Move01Icon} size={14} />Drag to move</Pill>
        </Sheet>
    {/snippet}
</Story>

<Story name="Card">
    {#snippet template()}
        <Sheet>
            <ProgressCard
                class="w-105"
                title="Joining 2 takes"
                progress={64}
                note="The timeline fills in once they're joined."
            />
            <ListCard class="w-90">
                {#each [['Take 1', '00:42'], ['Take 2', '00:36']] as [name, duration] (name)}
                    <li>
                        <Icon icon={VideoReplayIcon} size={22} />
                        <span class="font-semibold">{name}</span>
                        <span class="flex-1"></span>
                        <span class="text-small text-yd-muted">{duration}</span>
                    </li>
                {/each}
            </ListCard>
        </Sheet>
    {/snippet}
</Story>

<Story name="Progress">
    {#snippet template()}
        <Sheet>
            <div class="flex w-105 flex-col gap-2">
                <div class="flex items-center gap-3.5">
                    <span class="text-small text-yd-ink">Exporting</span>
                    <span class="flex-1"></span>
                    <span class="text-small text-yd-ink">64%</span>
                </div>
                <ProgressBar value={64} />
            </div>
        </Sheet>
    {/snippet}
</Story>

<Story name="Skeleton">
    {#snippet template()}
        <Sheet>
            <div class="flex w-160 flex-col gap-3">
                <div class="flex items-center gap-3.5">
                    <SkeletonBlock class="h-11 w-27.5" />
                    <SkeletonBlock class="size-11" />
                    <SkeletonBlock class="size-11" />
                    <span class="flex-1"></span>
                    <SkeletonBlock class="h-11 w-37.5" />
                </div>
                <div class="flex gap-0.75">
                    {#each { length: 7 } as _, i (i)}
                        <SkeletonBlock
                            class="h-16 w-20 rounded-frame border-[1.5px] border-solid border-yd-rule"
                        />
                    {/each}
                </div>
            </div>
        </Sheet>
    {/snippet}
</Story>

<Story name="Notice">
    {#snippet template()}
        <Sheet>
            <Notice icon={CheckmarkCircle02Icon} class="w-170" ondismiss={() => {}}>
                <b>Exported.</b> Saved youdemo-2026-10-09-201512.webm to your downloads.
            </Notice>
            <Notice icon={SecurityCheckIcon} title="Your recording is safe" class="w-170">
                Every take is saved in this browser as you record.
            </Notice>
        </Sheet>
    {/snippet}
</Story>

<Story name="StatusList">
    {#snippet template()}
        <Sheet>
            <StatusList
                class="w-140"
                rows={[
                    { name: 'Screen capture', available: true },
                    { name: 'Camera', available: false, optional: true }
                ]}
            />
        </Sheet>
    {/snippet}
</Story>

<Story name="Tooltip">
    {#snippet template()}
        <Sheet>
            <TooltipPrimitive.Root open>
                <TooltipPrimitive.ContentStatic class={tooltipClass}>
                    MacBook Pro Microphone
                </TooltipPrimitive.ContentStatic>
            </TooltipPrimitive.Root>
        </Sheet>
    {/snippet}
</Story>

<Story name="Breadcrumb">
    {#snippet template()}
        <Sheet>
            <div class="w-full overflow-hidden rounded-control border-[1.5px] border-yd-ink">
                <EditorBreadcrumb onback={() => {}} onnewrecording={() => {}} />
            </div>
        </Sheet>
    {/snippet}
</Story>

<Story name="CaptureDock">
    {#snippet template()}
        <Sheet>
            <div class="flex flex-col gap-3.5">
                <CaptureDock micMuted={false} camEnabled blurOn />
                <CaptureDock micMuted camEnabled={false} blurOn={false} />
                <CaptureDock micMuted={false} camEnabled blurOn locked />
            </div>
        </Sheet>
    {/snippet}
</Story>

<Story name="AlertDialog">
    {#snippet template()}
        <Sheet>
            <div class="relative h-90 w-full overflow-hidden rounded-notice">
                <ConfirmDialog
                    open
                    title="Export your video?"
                    body="YouDemo saves it to your downloads as a .webm file. Your cuts stay here, so you can export again."
                    details={[
                        { label: 'Length', value: '01:18' },
                        { label: 'Cuts', value: '1' },
                        { label: 'File', value: 'youdemo-2026-10-09-201512.webm' }
                    ]}
                    cancelLabel="Cancel"
                    confirmLabel="Export"
                    confirmIcon={Download04Icon}
                    onconfirm={() => {}}
                />
            </div>
        </Sheet>
    {/snippet}
</Story>

<Story name="Timeline">
    {#snippet template()}
        <Sheet>
            <div class="flex w-220 flex-col gap-1.5">
                <OverviewBar
                    windowStart={14}
                    windowWidth={16}
                    cuts={[22]}
                    playhead={21}
                    onpan={() => {}}
                />
                <FrameStrip
                    class="pt-7.5"
                    items={fixtureStrip([
                        'frame',
                        'frame',
                        'cut',
                        'frame',
                        'current',
                        'frame',
                        'frame',
                        'marked',
                        'marked',
                        'frame'
                    ])}
                    onframeclick={() => {}}
                    onrestore={() => {}}
                />
                <TimelineLabels start="00:12" end="01:18 after cuts" />
            </div>
        </Sheet>
    {/snippet}
</Story>

<Story name="EditorToolbar">
    {#snippet template()}
        <Sheet>
            <div class="flex w-full flex-col gap-2">
                {#each [false, true] as trimming (trimming)}
                    <EditorToolbar
                        {trimming}
                        canUndo
                        canRedo
                        zoomLabel="0.2 s a frame"
                        canZoomIn={false}
                        canZoomOut
                        selection="0.6 s"
                        ontoggletrim={() => {}}
                        onundo={() => {}}
                        onredo={() => {}}
                        onzoomin={() => {}}
                        onzoomout={() => {}}
                        onremove={() => {}}
                    />
                {/each}
            </div>
        </Sheet>
    {/snippet}
</Story>

<Story name="WebcamBubble">
    {#snippet template()}
        <Sheet>
            <div
                class="relative h-50 w-105 rounded-control border-[1.5px] border-yd-ink bg-yd-card"
            >
                <WebcamBubble
                    position="tr"
                    size={64}
                    inset={6}
                    slots="always"
                    slotPositions={['tl', 'tc', 'bl', 'br']}
                />
            </div>
            <div
                class="relative h-50 w-105 rounded-control border-[1.5px] border-yd-ink bg-yd-card"
            >
                <WebcamBubble position="tr" size={64} inset={6} enlargedSize={146} enlarged />
            </div>
            <WebcamBubbleFace size={224} hint />
        </Sheet>
    {/snippet}
</Story>

<Story name="DropdownMenu">
    {#snippet template()}
        <Sheet>
            <DropdownMenuPrimitive.Root open>
                <DropdownMenuPrimitive.ContentStatic class={menuClass}>
                    <MenuOptions
                        options={[
                            { value: 'light', label: 'Light' },
                            { value: 'default', label: 'Default' },
                            { value: 'heavy', label: 'Heavy' }
                        ]}
                        value="default"
                        onselect={() => {}}
                    />
                </DropdownMenuPrimitive.ContentStatic>
            </DropdownMenuPrimitive.Root>
        </Sheet>
    {/snippet}
</Story>
