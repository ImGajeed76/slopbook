<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group';

	export type SortMode = 'hot' | 'new' | 'top';

	interface Props {
		active: SortMode;
		onchange: (mode: SortMode) => void;
	}

	let { active, onchange }: Props = $props();
</script>

<ToggleGroup.Root
	type="single"
	variant="outline"
	size="sm"
	value={active}
	onValueChange={(v) => { if (v) onchange(v as SortMode); }}
>
	<ToggleGroup.Item value="hot">Hot</ToggleGroup.Item>
	<ToggleGroup.Item value="new">New</ToggleGroup.Item>
	<ToggleGroup.Item value="top">Top</ToggleGroup.Item>
</ToggleGroup.Root>
