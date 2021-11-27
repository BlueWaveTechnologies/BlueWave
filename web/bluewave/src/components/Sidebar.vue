<script>
export default {
  data () {
    return {
      favs: [
        {id: 1, name: "test"},
        {id: 2, name: "test2"}
      ],
      editing: false
    }
  },
  methods: {
    toggleEdit () {
      this.editing = !this.editing;
    },
    deleteItem (id) {
      this.favs = this.favs.filter(item => item.id != id);
    }
  }
}
</script>

<template>
  <div class="float-sidebar">
    <div class="edit" v-on:click="toggleEdit"></div>
    <h3>Favorites</h3>
    <ul>
      <li v-for="item in favs" v-bind:key="item.id">
        <span v-if="editing" class="delete" v-on:click="deleteItem(item.id)">x</span>
        <a v-bind:href="'#'+item.id">{{item.name}}</a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
a {
  color: #42b983;
}

.float-sidebar {
  position: absolute;
  top: 0px;
  left: 0px;
  width: 300px;
  height: 100%;
  padding: 0 1.5em;
  background: #e6e6e8;
  text-align: left;
}

.float-sidebar .edit {
  background-image: url('./src/assets/edit.png');
  background-size: 1.2em;
  width: 1.2em;
  height: 1.2em;
  float: right;
  margin: 1.4em 0;
  cursor: pointer;
}

.float-sidebar .delete {
  float: right;
  cursor: pointer;
}
</style>
