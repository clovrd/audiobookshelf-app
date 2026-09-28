<template>
  <div class="w-full h-full"></div>
</template>

<script>
export default {
  async asyncData({ redirect, app }) {
    // Starts in the kids mode until a parent leaves it (components/kids/Shell.vue)
    const kidsMode = await app.$localStore.getPreferenceByKey('kidsMode')
    return redirect(kidsMode === '1' ? '/kids' : '/bookshelf')
  },
  data() {
    return {}
  },
  computed: {},
  methods: {}
}
</script>
