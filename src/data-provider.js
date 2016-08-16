import EventEmitter from 'eventemitter3';
import _ from 'lodash';
import { uuidRegExp } from './utils/helpers';

import {
  getUri,
  getParallel,
  getAllContainers,
  getAllNodes,
  getAllTasks,
  getAllNodeClusters,
  getWebSocket
} from './utils/request';

var STARTED = 0;

let SINGLETON,
    CURRENT_SERVICES_URIS;

let PHYSICAL_STRUCT;

function tutumEventHandler(e) {
  console.log(e);
}

function nodeOrContainerExists(arr, value) {

  for (var i=0, iLen=arr.length; i<iLen; i++) {

    if (arr[i].ID == value) return true;
  }
  return false;
}


function physicalStructProvider([initialNodes,initialContainers]){
  let containers = _.map(initialContainers, _.cloneDeep);
  let nodeClusters = [{uuid:"clusterid", name:""}];
  let nodes = _.map(initialNodes, _.cloneDeep);
  let root = [];

  let addContainer = (container) => {
    var cloned = Object.assign({},container);
    let NodeID = cloned.NodeID;
    _.find(root,(cluster) => {
      var node = _.find(cluster.children,{ ID:NodeID });
      if(!node) return;
      let imageTag = cloned.Spec.ContainerSpec.Image.split(':')[1];
      cloned.tag = imageTag;
      node.children.push(cloned);
      return true;
    });
  
  },
  updateContainer = (container) => {
    let {uuid, node} = container;
    let [nodeUuid] = uuidRegExp.exec(node);
     _.find(root,(cluster) => {
       let node = _.findWhere(cluster.children,{ uuid: nodeUuid });
       if(!node) return;

      let target = _.findWhere(node.children,{ uuid }) || {};
      if(!target) return;

      Object.assign(target,container);
      return true;
    });
  }, 
  data = () => {
    let clone = _.cloneDeep(root);
    _.remove(clone,({uuid,children}) => {
      return uuid === 'BYON' && !children.length
    });

    return {root: clone};
  },
  addNodeCluster = (nodeCluster) => {
    var cloned = Object.assign({},nodeCluster);
    cloned.children = [];
    console.log(cloned);
    root.push(cloned);
  },
  removeNodeCluster = (nodeCluster) => {
    _.remove(root,{ uuid: nodeCluster.uuid });
  },
  updateNodeCluster = (nodeCluster) => {
    var currentCluster = _.findWhere(root,{ uuid: nodeCluster.uuid });
    Object.assign(currentCluster,nodeCluster);
  },
  addNode = (node) => {
    let cloned = Object.assign({},node);
    cloned.children = [];
    console.log(cloned);
    let clusterUuid = "clusterid";
    let cluster = _.findWhere(root,{ uuid: clusterUuid });
    if(cluster) cluster.children.push(cloned);
  },
  updateNode = (node, state) => {
    node.state = state;
  },
  updateData = (resources) => {
    updateNodes(resources[0]);
    
    updateContainers(resources[1]);
    data();
  },
  updateNodes = (nodes) => {
    console.log(nodes);
    let currentnodelist = root[0].children;
    for (let node of nodes) {
      if(!nodeOrContainerExists(currentnodelist,node.ID)) {
        updateNode(node,'ready');
        addNode(node);
    } else {
      for (let currentnode of currentnodelist) {
        if (node.ID == currentnode.ID) {
          name = node.Description.Hostname;
          if(name.length>0) {
            currentnode.Description.Hostname = name;
          }
          updateNode(currentnode, node.state);
        } 
      }
      
    }
  }
    for (let node of currentnodelist) {
      if(!nodeOrContainerExists(nodes,node.ID)){
        updateNode(node,'down');
      }
    }
},
  updateContainers = (containers) => {
    let nodes = root[0].children;
    for (let container of containers) {
      let contNodeId = container.NodeID;

   for (var i=0, iLen=nodes.length; i<iLen; i++) {
    if (nodes[i].ID == contNodeId) {
      if(!nodeOrContainerExists(nodes[i].children,container.ID)){
        addContainer(container);
      }
    }
  }

    }
    for(let node of nodes) {
      for(let container of node.children) {
        if(!nodeOrContainerExists(containers,container.ID)){
          let index = node.children.indexOf(container);
          node.children.splice(index,1);
        }
      }
    }

  };

  nodeClusters.forEach(addNodeCluster);
  nodes.forEach(addNode);

  containers.forEach(addContainer);

  return {
    addContainer,
    updateData,
    updateContainer,
    data,
    addNode,
    updateNode,
    addNodeCluster,
    removeNodeCluster,
    updateNodeCluster,    
  };
}



class DataProvider extends EventEmitter {
  constructor(){
    super()
    
  }
  
  start(){
    STARTED = 1;
    console.log(STARTED);
    var clusterInit = Promise.all([
      getAllNodes(),
      getAllTasks()
      ])
    .then((resources) => {
      _.remove(resources[1],(nc) => nc.state === 'Empty cluster' || nc.state === 'Terminated');
      return resources;
    });

      Promise.all([ clusterInit ])
      .then(([resources]) => {
      PHYSICAL_STRUCT = physicalStructProvider(resources);
      this.emit('infrastructure-data',PHYSICAL_STRUCT.data());
      this.emit('start-reload');
       });
  }
  reload() {
    if(STARTED ==0) return;
    STARTED++;
    console.log(STARTED);
    var clusterInit = Promise.all([
      getAllNodes(),
      getAllTasks()
      ])
    .then((resources) => {
      _.remove(resources[1],(nc) => nc.state === 'Empty cluster' || nc.state === 'Terminated');
      return resources;
    });

      Promise.all([ clusterInit ])
      .then(([resources]) => {
      PHYSICAL_STRUCT.updateData(resources);
      this.emit('infrastructure-data',PHYSICAL_STRUCT.data());
    });
  }
  
}

export default SINGLETON = new DataProvider();
