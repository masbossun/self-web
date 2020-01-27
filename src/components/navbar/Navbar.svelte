<script>
  import Tailwindcss from "../../Tailwindcss.svelte";
  import { MenuIcon, XIcon } from "svelte-feather-icons";
  import Logo from "../common/Logo.svelte";
  import Navlink from "./Navlink.svelte";
  export let classes = "";
  let currentHref = window.location.href;

  let isMenuOpen = false;

  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }
</script>

<style>
  .menu-icon {
    height: 3rem;
    width: 3rem;
  }
</style>

<Tailwindcss />

<div class="flex justify-between items-center {classes}">
  <Logo />
  <div on:click={toggleMenu} class="flex md:hidden menu-icon cursor-pointer">
    <MenuIcon />
  </div>
  {#if isMenuOpen}
    <div class="fixed inset-0 bg-white z-40">
      <div class="flex flex-col justify-around items-center h-full py-64">
        <Navlink on:click={toggleMenu} text={'bio'} scrollTo={'#bio'} />
        <Navlink
          on:click={toggleMenu}
          text={'projects'}
          scrollTo={'#projects'} />
        <Navlink text={'blog'} link="https://masbossun.web.id/blog/" />
        <Navlink on:click={toggleMenu} text={'contact me'} scrollTo={'#footer'} hasShadow={true} />
      </div>
      <button
        on:click={toggleMenu}
        class="fixed bottom-0 right-0 z-50 mr-16 mb-16 w-12">
        <XIcon />
      </button>
    </div>
  {/if}
  <div class="hidden md:flex">
    <Navlink text={'bio'} scrollTo={'#bio'} />
    <Navlink text={'projects'} scrollTo={'#projects'} />
    <Navlink text={'blog'} link="https://masbossun.web.id/blog/" />
    <Navlink text={'contact me'} scrollTo={'#footer'} hasShadow={true} />
  </div>
</div>
