/**
 * Universal hierarchical composition. Area -> building -> room -> component,
 * or area -> actor/prop. Factory adapters own rendering/physics/AI and can be
 * swapped without changing blueprint definitions.
 */
export class ComponentFactory {
 constructor(){this.builders=new Map();}
 register(type,builder){if(typeof builder!=='function')throw Error('Builder must be function');this.builders.set(type,builder);return this;}
 instantiate(definition,{parent=null,context={},instances=new Map()}={}){
  if(!definition||typeof definition.type!=='string')throw Error('Component type required');
  if(!this.builders.has(definition.type))throw Error('Unregistered component type: '+definition.type);
  const id=String(definition.id??definition.type);
  if(instances.has(id))throw Error('Duplicate component id: '+id);
  const data={...definition,position:[...(definition.position??[0,0,0])]};
  const entity=this.builders.get(definition.type)(data,{parent,context});
  if(entity==null)throw Error('Builder returned no entity: '+id);
  const record={id,type:definition.type,definition:data,entity,parent,children:[]};
  instances.set(id,record);
  for(const child of definition.children??[]){
   record.children.push(this.instantiate(child,{parent:record,context,instances}));
  }
  return record;
 }
}
export function areaAsTree(area){
 const buildings=(area.buildings??[]).map((b,i)=>({
  type:'building',id:'building:'+String(b.id??i),position:b.position??[0,0,0],data:b,
  children:[
   ...(b.layouts??[]).map(layout=>({
    type:'layout',id:'layout:'+String(b.id??i)+':'+layout.id,position:layout.bounds?.center??[0,0,0],data:layout,
    children:(layout.objects??[]).map((o,j)=>({...o,id:'layout-object:'+String(b.id??i)+':'+layout.id+':'+String(o.id??j),type:o.type??'object'}))
   })),
   ...(b.floors??[]).map(f=>({
    type:'floor',id:'floor:'+String(b.id??i)+':'+f.index,position:[0,0,0],data:f,
    children:[
     ...(f.objects??[]).map((o,j)=>({...o,id:'object:'+String(b.id??i)+':'+f.index+':'+String(o.id??j),type:o.type??'object'})),
     ...(f.actors??[]).map((a,j)=>({...a,id:'actor:'+String(b.id??i)+':'+f.index+':'+String(a.id??j),type:'actor'}))
    ]
   })),
   ...(b.stair?[{type:'staircase',id:'stair:'+String(b.id??i),position:[b.stair.x,0,b.stair.z],data:b.stair}]:[])
  ]
 }));
 const actors=(area.actors??[]).map((a,i)=>({...a,type:'actor',id:'area:actor:'+String(a.id??i)}));
 const objects=(area.objects??[]).map((o,i)=>({...o,type:o.type??'object',id:'area:object:'+String(o.id??i)}));
 return {type:'area',id:'area:'+String(area.id),position:area.origin??[0,0,0],data:area,children:[...buildings,...objects,...actors]};
}
export function createRecordFactory(){
 const factory=new ComponentFactory();
 for(const type of ['area','building','layout','floor','staircase','object','actor','wall','door','furniture','light']){
  factory.register(type,(definition,{parent})=>({type,id:definition.id,position:definition.position,data:definition.data??definition,parentId:parent?.id??null}));
 }
 return factory;
}

/**
 * Resolve a composed blueprint to the actual game objects. The graph is stable
 * even if a 3D mesh is rebuilt. Domain state remains on the entity; scene
 * objects are replaceable views of that state.
 */
export class WorldEntityRegistry {
 constructor(root){this.root=root;this.nodes=new Map();this.byEntity=new WeakMap();this.walk(root,node=>this.nodes.set(node.id,node));}
 walk(node,visitor){visitor(node);for(const child of node.children??[])this.walk(child,visitor);}
 get(id){return this.nodes.get(String(id))??null;}
 attach(id,instance){
  const node=this.get(id);if(!node)throw Error('Unknown world entity: '+id);
  node.runtime=instance;
  if(instance&&typeof instance==='object')this.byEntity.set(instance,node);
  return node;
 }
 locate(instance){return instance&&typeof instance==='object'?this.byEntity.get(instance)??null:null;}
 query({type,capability,parentId}={}){
  return [...this.nodes.values()].filter(n=>
   (!type||n.type===type)&&
   (!capability||n.definition.data?.attributes?.capabilities?.includes(capability))&&
   (!parentId||n.parent?.id===parentId));
 }
 snapshot(){
  const out=[];
  for(const node of this.nodes.values()){
   if(!node.runtime)continue;
   const p=node.runtime.position;
   out.push({id:node.id,type:node.type,position:p&&typeof p.toArray==='function'?p.toArray():node.definition.position});
  }
  return out;
 }
}
