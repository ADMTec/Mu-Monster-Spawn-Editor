import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { produce } from 'immer';
import { MapInfo, Monster, MapData, Spot, Spawn, SpotType } from './types';
import { monsterListData as initialMonsterList, monsterSpawnData as initialMonsterSpawn, mapListData as initialMapList } from './services/xmlData';
import { generateMonsterImage } from './services/geminiService';
import Card from './components/shared/Card';
import Button from './components/shared/Button';
import Spinner from './components/shared/Spinner';
import MapPreviewWindow from './components/MapPreviewWindow';

const App: React.FC = () => {
    const [monsters, setMonsters] = useState<Monster[]>([]);
    const [mapInfos, setMapInfos] = useState<MapInfo[]>([]);
    const [mapData, setMapData] = useState<MapData[]>([]);
    
    const [selectedMapNumber, setSelectedMapNumber] = useState<number | null>(null);
    const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
    const [selectedSpawnUUID, setSelectedSpawnUUID] = useState<string | null>(null);

    const [showMapPreview, setShowMapPreview] = useState(false);
    const [monsterImages, setMonsterImages] = useState<Record<string, string>>({});
    const [loadingImages, setLoadingImages] = useState<string[]>([]);
    const [selectedMonsterForAdd, setSelectedMonsterForAdd] = useState<Monster | null>(null);
    const [isAddSpotModalOpen, setIsAddSpotModalOpen] = useState(false);
    const [newSpotDetails, setNewSpotDetails] = useState({ type: SpotType.SingleSpawn, description: '' });

    const getAttributeValue = (element: Element, attributeName: string) => {
        const value = element.getAttribute(attributeName);
        return value ? value.trim() : null;
    };

    const parseMonsters = useCallback((xmlString: string): Monster[] => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        const monsterNodes = xmlDoc.getElementsByTagName('Monster');
        return Array.from(monsterNodes).map(node => {
            const monster: any = {};
            for (const attr of Array.from(node.attributes)) {
                const camelCaseName = attr.name.charAt(0).toLowerCase() + attr.name.slice(1);
                const value = isNaN(Number(attr.value)) ? attr.value : Number(attr.value);
                monster[camelCaseName] = value;
            }
            return monster as Monster;
        });
    }, []);
    
    const parseMapList = useCallback((xmlString: string): MapInfo[] => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        const mapNodes = xmlDoc.querySelectorAll('DefaultMaps Map');
        return Array.from(mapNodes).map(node => {
            const fileAttr = getAttributeValue(node, 'File') || '';
            const nameMatch = fileAttr.match(/\d+_(.+?)\.att/);
            const name = nameMatch ? nameMatch[1].replace(/_/g, ' ') : `Map ${getAttributeValue(node, 'Number')}`;
            return {
                number: Number(getAttributeValue(node, 'Number')),
                file: fileAttr,
                name: name,
            };
        });
    }, []);

    const parseMapSpawns = useCallback((xmlString: string, allMonsters: Monster[]): MapData[] => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        const mapNodes = xmlDoc.getElementsByTagName('Map');
        const monsterNameMap = allMonsters.reduce((acc, m) => ({ ...acc, [m.index]: m.name }), {} as Record<number, string>);
        
        const mapsRecord: Record<number, MapData> = {};

        Array.from(mapNodes).forEach(mapNode => {
            const mapNumber = Number(getAttributeValue(mapNode, 'Number'));
            
            if (isNaN(mapNumber)) return;
            
            if (!mapsRecord[mapNumber]) {
                mapsRecord[mapNumber] = {
                    number: mapNumber,
                    name: getAttributeValue(mapNode, 'Name') || `Map ${mapNumber}`,
                    spots: [],
                };
            }
            
            const spotNodes = mapNode.getElementsByTagName('Spot');
            Array.from(spotNodes).forEach(spotNode => {
                const spot: Spot = {
                    type: Number(getAttributeValue(spotNode, 'Type')),
                    description: getAttributeValue(spotNode, 'Description') || `Spot`,
                    spawns: [],
                };
                
                const spawnNodes = spotNode.getElementsByTagName('Spawn');
                Array.from(spawnNodes).forEach(spawnNode => {
                    const spawn: Spawn = {
                        uuid: uuidv4(),
                        index: Number(getAttributeValue(spawnNode, 'Index')),
                        distance: Number(getAttributeValue(spawnNode, 'Distance') || '0'),
                        startX: Number(getAttributeValue(spawnNode, 'StartX') || '0'),
                        startY: Number(getAttributeValue(spawnNode, 'StartY') || '0'),
                        endX: Number(getAttributeValue(spawnNode, 'EndX') || getAttributeValue(spawnNode, 'StartX') || '0'),
                        endY: Number(getAttributeValue(spawnNode, 'EndY') || getAttributeValue(spawnNode, 'StartY') || '0'),
                        dir: Number(getAttributeValue(spawnNode, 'Dir') || '-1'),
                        count: Number(getAttributeValue(spawnNode, 'Count') || '1'),
                        element: getAttributeValue(spawnNode, 'Element') ? Number(getAttributeValue(spawnNode, 'Element')) : undefined,
                        monsterName: monsterNameMap[Number(getAttributeValue(spawnNode, 'Index'))] || 'Unknown'
                    };
                    spot.spawns.push(spawn);
                });
                mapsRecord[mapNumber].spots.push(spot);
            });
        });
        
        return Object.values(mapsRecord);
    }, []);
    
    const parseAndLoadXml = async (file: File, parser: (xml: string, monsters?: Monster[]) => any, setter: (data: any) => void, secondaryData?: any) => {
        try {
            let text = await file.text();
            text = text.replace(/<!--(.*?)--/g, (match, content) => `<!--${content.replace(/--/g, '- -')}-->`);
            const parsedData = parser(text, secondaryData);
            setter(parsedData);
        } catch (error) {
            console.error("Error parsing XML:", error);
            alert(`Failed to parse ${file.name}. Check console for details.`);
        }
    };

    const handleFileLoad = (parser: (xml: string, monsters?: Monster[]) => any, setter: (data: any) => void, secondaryData?: any) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            parseAndLoadXml(file, parser, setter, secondaryData);
        }
    };
    
    const combinedMapList = useMemo(() => {
        const allMaps = new Map<number, MapInfo>();
        mapInfos.forEach(map => allMaps.set(map.number, map));
        mapData.forEach(md => {
            if (!allMaps.has(md.number)) {
                allMaps.set(md.number, { number: md.number, file: '', name: md.name });
            } else {
                const existing = allMaps.get(md.number)!;
                if (!existing.name) existing.name = md.name;
            }
        });
        return Array.from(allMaps.values()).sort((a, b) => a.number - b.number);
    }, [mapInfos, mapData]);
    
    const totalMonsterCount = useMemo(() => {
        return mapData.reduce((total, map) => {
            return total + map.spots.reduce((mapTotal, spot) => {
                return mapTotal + spot.spawns.reduce((spotTotal, spawn) => spotTotal + spawn.count, 0);
            }, 0);
        }, 0);
    }, [mapData]);

    const handleGenerateImage = async (monster: Monster) => {
        if (monsterImages[monster.name] || loadingImages.includes(monster.name)) return;
        setLoadingImages(produce(draft => { draft.push(monster.name); }));
        const imageUrl = await generateMonsterImage(monster.name);
        setMonsterImages(produce(draft => { draft[monster.name] = imageUrl; }));
        setLoadingImages(produce(draft => {
            const index = draft.indexOf(monster.name);
            if (index > -1) draft.splice(index, 1);
        }));
    };
    
    const handleAddSpot = () => {
        if (selectedMapNumber === null) return;
        setMapData(produce(draft => {
            const map = draft.find(m => m.number === selectedMapNumber);
            if (map) {
                map.spots.push({
                    type: newSpotDetails.type,
                    description: newSpotDetails.description || `New Spot ${map.spots.length + 1}`,
                    spawns: []
                });
            }
        }));
        setIsAddSpotModalOpen(false);
        setNewSpotDetails({ type: SpotType.SingleSpawn, description: '' });
    };

    const addSpawnToMap = (newSpawn: Omit<Spawn, 'uuid' | 'monsterName'>, spotType: SpotType, spotDescription: string) => {
        if (selectedMapNumber === null) return;
        setMapData(produce(draft => {
            const map = draft.find(m => m.number === selectedMapNumber);
            if (map) {
                let spot = map.spots.find(s => s.type === spotType);
                if (!spot) {
                    spot = { type: spotType, description: spotDescription, spawns: [] };
                    map.spots.push(spot);
                }
                spot.spawns.push({
                    ...newSpawn,
                    uuid: uuidv4(),
                    monsterName: monsters.find(m => m.index === newSpawn.index)?.name || 'Unknown'
                });
            }
        }));
        setSelectedMonsterForAdd(null);
    };

    const onAddSpawn = (x: number, y: number) => {
        if (!selectedMonsterForAdd) return;
        addSpawnToMap({
            index: selectedMonsterForAdd.index,
            distance: 10,
            startX: x, startY: y, endX: x, endY: y,
            dir: -1, count: 1
        }, SpotType.SingleSpawn, 'Single Monster Spawn');
    };

    const onAddAreaSpawn = (startX: number, startY: number, endX: number, endY: number) => {
        if (!selectedMonsterForAdd) return;
        addSpawnToMap({
            index: selectedMonsterForAdd.index,
            distance: 0,
            startX, startY, endX, endY,
            dir: -1, count: 10,
        }, SpotType.MultiSpawn, 'Multiple Monsters Spawn');
    };
    
    const handleDeleteSpawn = (spawnToDelete: Spawn) => {
        setMapData(produce(draft => {
            const map = draft.find(m => m.number === selectedMapNumber);
            if (map) {
                map.spots.forEach(spot => {
                    spot.spawns = spot.spawns.filter(s => s.uuid !== spawnToDelete.uuid);
                });
                map.spots = map.spots.filter(s => s.spawns.length > 0);
            }
        }));
        if (selectedSpawnUUID === spawnToDelete.uuid) {
            setSelectedSpawnUUID(null);
        }
    };

    const handleUpdateSpawn = (updatedSpawn: Spawn) => {
        setMapData(produce(draft => {
             const map = draft.find(m => m.number === selectedMapNumber);
             if(map) {
                 for(const spot of map.spots) {
                     const spawnIndex = spot.spawns.findIndex(s => s.uuid === updatedSpawn.uuid);
                     if(spawnIndex !== -1) {
                         spot.spawns[spawnIndex] = updatedSpawn;
                         break;
                     }
                 }
             }
        }));
    };
    
    const selectedMapData = mapData.find(m => m.number === selectedMapNumber) || null;
    const selectedSpawn = selectedMapData?.spots.flatMap(s => s.spawns).find(s => s.uuid === selectedSpawnUUID) || null;
    const monsterForDetailView = selectedSpawn ? monsters.find(m => m.index === selectedSpawn.index) : selectedMonster;

    return (
        <div className="bg-gray-900 text-gray-200 min-h-screen font-sans p-2 flex flex-col gap-2">
            <header className="flex justify-between items-center pb-2 border-b border-gray-700 flex-wrap gap-2">
                <h1 className="text-lg font-bold text-gray-100">MU Monster Spawn Editor</h1>
                <div className="flex gap-2 items-center flex-wrap">
                    <input type="file" id="monsterListFile" className="hidden" accept=".xml" onChange={handleFileLoad(parseMonsters, setMonsters)} />
                    <Button onClick={() => document.getElementById('monsterListFile')?.click()}>Load MonsterList.xml</Button>
                    <input type="file" id="mapListFile" className="hidden" accept=".xml" onChange={handleFileLoad(parseMapList, setMapInfos)} />
                    <Button onClick={() => document.getElementById('mapListFile')?.click()}>Load MapList.xml</Button>
                    <input type="file" id="spawnFile" className="hidden" accept=".xml" onChange={handleFileLoad(parseMapSpawns, setMapData, monsters)} />
                    <Button onClick={() => document.getElementById('spawnFile')?.click()}>Load MonsterSpawn.xml</Button>
                    <Button onClick={() => setShowMapPreview(true)} disabled={!selectedMapData}>Map Preview</Button>
                </div>
            </header>

            <main className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-grow min-h-0">
                {/* Left Column */}
                <div className="flex flex-col gap-2 min-h-0">
                    <Card title={`Maps (${combinedMapList.length}) - Total Monsters: ${totalMonsterCount}`} className="flex-1">
                        <div className="overflow-y-auto p-1">
                            {combinedMapList.map(map => (
                                <div key={map.number} onClick={() => setSelectedMapNumber(map.number)}
                                    className={`cursor-pointer p-1.5 text-xs rounded flex justify-between items-center ${selectedMapNumber === map.number ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>
                                    <span>{map.number} - {map.name}</span>
                                    <span className="text-gray-400 text-2xs">({mapData.find(m=>m.number === map.number)?.spots.reduce((acc, s) => acc + s.spawns.reduce((sAcc, sp) => sAcc + sp.count, 0), 0) || 0})</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                    <Card title={`All Monsters (${monsters.length})`} className="flex-1">
                         <div className="overflow-y-auto p-1">
                            {monsters.map(monster => (
                                <div key={monster.index} onClick={() => { setSelectedMonster(monster); setSelectedSpawnUUID(null); }}
                                    className={`cursor-pointer p-1.5 text-xs rounded ${selectedMonster?.index === monster.index && !selectedSpawnUUID ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>
                                    {monster.name}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Middle Column */}
                <Card title="Map Monsters" className="min-h-0" headerContent={<Button onClick={() => setIsAddSpotModalOpen(true)} disabled={selectedMapNumber === null}>Add New Spot</Button>}>
                    <div className="overflow-y-auto p-1">
                        {selectedMapData ? (
                            selectedMapData.spots.map((spot, spotIndex) => (
                                <div key={spotIndex} className="mb-2">
                                    <h3 className="text-xs font-semibold text-cyan-400 bg-gray-900 p-1 rounded-t">{spot.type === SpotType.NPC ? "NPC/Traps" : spot.type === SpotType.MultiSpawn ? "Multiple Monsters Spawn" : spot.type === SpotType.SingleSpawn ? "Single Monster Spawn" : "Elemental Monster Spawn"} - <span className="font-light text-gray-400">{spot.description}</span></h3>
                                    <ul className="bg-gray-800/50 rounded-b">
                                        {spot.spawns.map(spawn => (
                                            <li key={spawn.uuid} onClick={() => { setSelectedSpawnUUID(spawn.uuid); setSelectedMonster(null); }}
                                                className={`cursor-pointer p-1.5 text-xs rounded flex justify-between items-center ${selectedSpawnUUID === spawn.uuid ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>
                                                <span>{spawn.monsterName} {spawn.count > 1 ? `(${spawn.count})` : ''}</span>
                                                <button className="text-red-500 hover:text-red-300 font-bold px-1" onClick={(e) => { e.stopPropagation(); handleDeleteSpawn(spawn); }}>×</button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))
                        ) : <p className="p-2 text-xs text-gray-400">Select a map to see monster spawns.</p>}
                    </div>
                </Card>

                {/* Right Column */}
                <Card title="Details" className="min-h-0">
                    <div className="p-3 overflow-y-auto">
                        {selectedSpawn && (
                            <div className="space-y-2 text-xs">
                                <h3 className="font-bold text-base text-cyan-400">{selectedSpawn.monsterName} (Spawn)</h3>
                                {Object.entries(selectedSpawn).map(([key, value]) => {
                                     if (key === 'uuid' || key === 'monsterName') return null;
                                     return (
                                        <div key={key} className="flex items-center">
                                            <label className="w-28 capitalize text-gray-400">{key.replace(/([A-Z])/g, ' $1')}:</label>
                                            <input type="text" value={value?.toString() || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    handleUpdateSpawn({ ...selectedSpawn, [key]: isNaN(Number(val)) ? val : Number(val) });
                                                }}
                                                className="bg-gray-900 border border-gray-600 text-gray-200 text-xs rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-500" />
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        {monsterForDetailView && !selectedSpawn && (
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-base text-cyan-400">{monsterForDetailView.name}</h3>
                                    <Button onClick={() => { setSelectedMonsterForAdd(monsterForDetailView); setShowMapPreview(true); }} disabled={!selectedMapData}>
                                        Add to Map
                                    </Button>
                                </div>
                                <div className="flex flex-col items-center mb-3">
                                    {loadingImages.includes(monsterForDetailView.name) ? <div className="w-32 h-32 bg-gray-700 flex items-center justify-center rounded"><Spinner /></div>
                                     : monsterImages[monsterForDetailView.name] ? <img src={monsterImages[monsterForDetailView.name]} alt={monsterForDetailView.name} className="w-32 h-32 object-cover border border-gray-600 rounded"/>
                                     : <div className="w-32 h-32 bg-gray-700 flex items-center justify-center text-gray-400 text-center rounded">No Image</div>
                                    }
                                    <Button onClick={() => handleGenerateImage(monsterForDetailView)} className="mt-2 w-32" disabled={loadingImages.includes(monsterForDetailView.name) || !!monsterImages[monsterForDetailView.name]}>
                                        {loadingImages.includes(monsterForDetailView.name) ? "Generating..." : monsterImages[monsterForDetailView.name] ? "Generated" : "Generate Image"}
                                    </Button>
                                </div>
                                <div className="space-y-1 text-xs">
                                    {Object.entries(monsterForDetailView).map(([key, value]) => (
                                        <div key={key}>
                                            <span className="font-semibold text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}: </span>
                                            <span className="text-gray-200">{value.toString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!selectedSpawn && !monsterForDetailView && <p className="text-xs text-gray-400">Select a monster or a spawn to see details.</p>}
                    </div>
                </Card>
            </main>

            <MapPreviewWindow show={showMapPreview} onClose={() => { setShowMapPreview(false); setSelectedMonsterForAdd(null); }}
                mapData={selectedMapData} allMonsters={monsters} selectedMonsterForAdd={selectedMonsterForAdd}
                onAddSpawn={onAddSpawn} onAddAreaSpawn={onAddAreaSpawn} />
            
            {isAddSpotModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 w-96 space-y-3">
                        <h2 className="text-lg font-bold">Add New Spot</h2>
                        <div>
                            <label className="text-sm text-gray-400 block mb-1">Spot Type</label>
                            <select value={newSpotDetails.type} onChange={e => setNewSpotDetails({...newSpotDetails, type: Number(e.target.value)})} className="bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value={SpotType.NPC}>NPC/Traps</option>
                                <option value={SpotType.MultiSpawn}>Multiple Monsters Spawn</option>
                                <option value={SpotType.SingleSpawn}>Single Monster Spawn</option>
                                <option value={SpotType.ElementalSpawn}>Elemental Monster Spawn</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 block mb-1">Description</label>
                            <input type="text" value={newSpotDetails.description} onChange={e => setNewSpotDetails({...newSpotDetails, description: e.target.value})} className="bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g., Lorencia Spiders" />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button onClick={() => setIsAddSpotModalOpen(false)} className="bg-gray-600 hover:bg-gray-500">Cancel</Button>
                            <Button onClick={handleAddSpot} className="bg-blue-600 hover:bg-blue-500">Create Spot</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;