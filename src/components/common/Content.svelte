<script>
  import { createEventDispatcher } from "svelte";
  import Tailwindcss from "../../Tailwindcss.svelte";
  export let classes = "";
  export let id = "";

  export let clientHeight = 0;
</script>

<Tailwindcss />
<div {id} class="min-h-screen {classes}" bind:clientHeight>
  <slot />
</div>
