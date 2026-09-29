<template>
  <div class="w-full h-full"></div>
</template>

<script>
export default {
  async asyncData({ redirect, app, store }) {
    // The app starts in the kids mode once a server is set up. A parent leaving it through the parent sheet
    // gets the normal UI until the app is restarted (components/kids/Shell.vue).
    if (store.state.kids.parentExited) return redirect('/bookshelf')
    const deviceData = await app.$db.getDeviceData().catch(() => null)
    return redirect(deviceData?.lastServerConnectionConfigId ? '/kids' : '/bookshelf')
  },
  data() {
    return {}
  },
  computed: {},
  methods: {}
}
</script>
