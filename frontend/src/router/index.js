import { createRouter, createWebHistory } from 'vue-router'
import Editor from '../frontend/components/Editor.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Editor',
      component: Editor
    },
  ]
})

export default router