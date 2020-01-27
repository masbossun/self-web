<script>
  import Tailwindcss from "../../Tailwindcss.svelte";
  import Content from "../common/Content.svelte";
  import Logo from "../common/Logo.svelte";
  import {
    LinkedinIcon,
    TwitterIcon,
    InstagramIcon,
    GithubIcon
  } from "svelte-feather-icons";
  export let classes = "";
  let currentYear = new Date().getFullYear();
</script>

<style>
  .content {
    height: 40vh;
    margin: 8rem 0;
  }
</style>

<Tailwindcss />

<footer id="footer">
  <div
    class="flex flex-col lg:flex-row justify-center items-center relative
    content">
    <div
      class="lg:absolute top-0 right-0 mt-4 lg:mr-24 text-center lg:text-right">
      <span
        class="font-sans font-bold text-3xl lg:text-4xl leading-tight
        tracking-tighter lg:opacity-10">
        Robert C. Martin, Clean Code:
        <br />
        A Handbook of Agile
        <br />
        Software Craftsmanship
      </span>
    </div>
    <div class="p-8 mr-0 lg:mx-32 z-10 text-center lg:text-left">
      <span class="font-sans font-normal text-xl md:text-4xl leading-relaxed">
        Clean code is not written by following a set of rules. You don’t become
        a software craftsman by learning a list of heuristics. Professionalism
        and craftsmanship come from values that drive
        <span class="font-serif italic">disciplines.</span>
      </span>
    </div>
  </div>

  <hr class="my-12" />

  <div>
    <div class="flex flex-col lg:flex-row items-center justify-between mb-24">
      <span class="font-sans font-bold text-2xl mb-8 lg:mb-0">
        get in touch
      </span>
      <div class="flex">
        <a href="https://linkedin.com/in/ryan-setiagi">
          <div class="w-8 text-black mx-4">
            <LinkedinIcon />
          </div>
        </a>
        <a href="https://github.com/masbossun">
          <div class="w-8 text-black mx-4">
            <GithubIcon />
          </div>
        </a>
        <a href="https://twitter.com/masbossun">
          <div class="w-8 text-black mx-4">
            <TwitterIcon />
          </div>
        </a>
        <a href="https://instagram.com/masbossun">
          <div class="w-8 text-black mx-4">
            <InstagramIcon />
          </div>
        </a>
      </div>
    </div>

    <div class="flex flex-col lg:flex-row justify-between items-center mb-8">
      <Logo classes="mb-8 lg:mb-0" />
      <div class="flex items-center flex-col lg:flex-row">
        <span class="font-sans text-black mx-4 mb-4 lg:mb-0">
          proudly made in jakarta, ID
        </span>
        <a href="#">
          <span class="font-serif text-black">
            @{currentYear} / masbossun LLC.
          </span>
        </a>
      </div>
    </div>
  </div>
</footer>
