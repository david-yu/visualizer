# This is a fork of the Tutum Visualizer

Demo container that displays services on a diagram.

Each node in the swarm will show all tasks running on it. When a service goes down it'll be removed. When a node goes down it won't, instead the circle at the top will turn red to indicate it went down. Tasks will be removed.
Occasionally the Remote API will return incomplete data, for instance the node can be missing a name. The next time info for that node is pulled, the name will update.


TODO:

* Take out or fix how dist works
* Comment much more extensively
* Create tests and make them work better
* Make CSS more elastic. Currently optimized for 3 nodes on a big screen

Example commands to get started:

```
docker run -it -d -p 5000:5000 -e HOST=172.28.128.27 -e PORT=5000 -v /var/run/docker.sock:/var/run/docker.sock manomarks/visualizer

docker service create --replicas 4 --name instavote -p 8080:80 instavote/vote

docker service ls

docker service tasks instavote

docker service scale instavote=6

docker service rm instavote

docker service create --replicas 6 --name instavote -p 8080:80 --update-delay 10s --update-parallelism 2 instavote/vote

docker service update --image instavote/vote:movies instavote
```
