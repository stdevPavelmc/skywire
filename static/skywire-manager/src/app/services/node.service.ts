import { Injectable } from '@angular/core';
import { interval, Observable, Subject, throwError, timer, Unsubscribable } from 'rxjs';
import { AutoStartConfig, Node, NodeApp, NodeInfo, SearchResult } from '../app.datatypes';
import { ApiService } from './api.service';
import { filter, flatMap, map, switchMap, take, timeout } from 'rxjs/operators';
import {StorageService} from "./storage.service";

@Injectable({
  providedIn: 'root'
})
export class NodeService {
  private nodes = new Subject<Node[]>();
  private nodesSubscription: Unsubscribable;
  private currentNode: Node;
  private storageService: Storage;

  constructor(
    private apiService: ApiService
  ) {
    this.storageService = StorageService.getNamedStorage('nodeLabel')
  }

  allNodes(): Observable<Node[]> {
    this.refreshNodes();
    return this.nodes.asObservable();
  }

  refreshNodes() {
    if (this.nodesSubscription) {
      this.nodesSubscription.unsubscribe();
    }

    this.nodesSubscription = timer(0, 10000).subscribe(() => {
      this.apiService.get('conn/getAll').subscribe((allNodes: Node[]) => {
        this.nodes.next(allNodes);
      });
    });
  }

  /**
   *
   * Get the label for a given node:
   * (1) If no label is stored in the browser's localStorage --> return a name corresponding to the IP
   * (2) If a label has already been stored in localStorage --> return it

   * @param {Node} node
   * @returns {string | null}
   */
  getLabel(node: Node): string | null
  {
    const nodeKey = node.key;
    let nodeLabel = this.storageService.getItem(nodeKey);

    if (nodeLabel === null)
    {
      nodeLabel = NodeService.getDefaultNodeLabel(node);
      if (nodeLabel !== null)
      {
        this.setLabel(node, nodeLabel);
      }
    }

    return nodeLabel;
  }

  setLabel(node: Node, label: string) {
    this.storageService.setItem(node.key, label);
  }

  node(key: string): Observable<Node> {
    return this.apiService.post('conn/getNode', {key}, {type: 'form'});
  }

  setCurrentNode(node: Node) {
    this.currentNode = node;
  }

  nodeApps(): Observable<NodeApp[]> {
    return this.nodeRequest('getApps');
  }

  nodeInfo(): Observable<NodeInfo> {
    return this.nodeRequest('getInfo');
  }

  setNodeConfig(data: any) {
    return this.nodeRequest('run/setNodeConfig', data, {type: 'form'});
  }

  updateNodeConfig() {
    return this.nodeRequest('run/updateNodeConfig');
  }

  getAutoStartConfig(): Observable<AutoStartConfig> {
    return this.nodeRequest('run/getAutoStartConfig', {
      key: this.currentNode.key
    }, {
      type: 'form',
    });
  }

  setAutoStartConfig(config: AutoStartConfig) {
    return this.nodeRequest('run/setAutoStartConfig', {
      key: this.currentNode.key,
      data: JSON.stringify(config),
    }, {
      type: 'form',
    });
  }

  searchServices(key: string, pages: number, limit: number, discoveryKey: string): Observable<SearchResult> {
    return this.nodeRequest('run/searchServices', {key, pages, limit, discoveryKey}, {type: 'form'})
      .pipe(switchMap(() => {
        return interval(500).pipe(
          flatMap(() => this.nodeRequest('run/getSearchServicesResult')),
          filter(result => result !== null),
          map(result => result[0]),
          take(1),
          timeout(5000),
        );
      }));
  }

  reboot(): Observable<any> {
    return this.nodeRequest('reboot', {}, {responseType: 'text'}).pipe(map(result => {
      if (result.indexOf('darwin') !== -1) {
        throw new Error(result);
      }

      return result;
    }));
  }

  checkUpdate(): Observable<boolean> {
    return this.nodeRequest('run/checkUpdate').pipe(map(result => {
      return result ? result : throwError(new Error('No update available.'));
    }));
  }

  update(): Observable<any> {
    return this.nodeRequest('update');
  }

  nodeRequest(endpoint: string, body: any = {}, options: any = {}) {
    const nodeAddress = this.currentNode.addr;

    options.params = Object.assign(options.params || {}, {
      addr: this.nodeRequestAddress(nodeAddress, endpoint),
    });

    return this.apiService.post('req', body, options);
  }

  private nodeRequestAddress(nodeAddress: string, endpoint: string) {
    return 'http://' + nodeAddress + '/node/' + endpoint;
  }

  /**
   * (1) Return a name corresponding to the node's IP
   *
   * Manager (IP:192.168.0.2)
   * Node1 (IP:192.168.0.3)
   * Node2 (IP:192.168.0.4)
   * Node3 (IP:192.168.0.5)
   * Node4 (IP:192.168.0.6)
   * Node5 (IP:192.168.0.7)
   * Node6 (IP:192.168.0.8)
   * Node7 (IP:192.168.0.9)
   *
   * @param {Node} node
   * @returns {string}
   */
  private static getDefaultNodeLabel(node: Node): string
  {
    let nodeLabel = null;
    try
    {
      const nodeNumber = parseInt(node.addr.split('.')[3].split(':')[0]);
      if (nodeNumber == 2)
      {
        nodeLabel = 'Manager';
      }
      else if (nodeNumber > 2 && nodeNumber < 8)
      {
        nodeLabel = `Node${nodeNumber - 2}`;
      }
      else
      {
        nodeLabel = node.addr;
      }
    }
    catch (e) {}

    return nodeLabel;
  }
}
