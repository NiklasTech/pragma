<script setup lang="ts">
import { data as groups } from "../../shortcuts.data";
</script>

<template>
  <div v-for="group in groups" :key="group.title" class="shortcut-group">
    <h2 :id="group.title.toLowerCase().replace(/[^a-z]+/g, '-')" tabindex="-1">
      {{ group.title }}
      <a
        class="header-anchor"
        :href="`#${group.title.toLowerCase().replace(/[^a-z]+/g, '-')}`"
        aria-hidden="true"
      ></a>
    </h2>
    <table>
      <thead>
        <tr>
          <th>Action</th>
          <th>macOS</th>
          <th>Windows and Linux</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in group.rows" :key="row.label">
          <td>{{ row.label }}</td>
          <td>
            <kbd v-if="row.mac">{{ row.mac }}</kbd
            ><span v-else class="none">none</span>
          </td>
          <td>
            <kbd v-if="row.other">{{ row.other }}</kbd
            ><span v-else class="none">none</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
