import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';

import type { Monster, MapData, MapInfo, Spot, Spawn } from './types';
import { SpotType } from './types';
import { generateMonsterImage } from './services/geminiService';
import { monsterListData as initialMonsterListData, monsterSpawnData as initialMonsterSpawnData, mapListData as initialMapListData } from './services/xmlData';

import Card from './components/shared/Card';
import Button from './components/shared/Button';
import Spinner from './components/shared/Spinner';
import MapPreviewWindow from './components/MapPreviewWindow';

const App: React.FC = () => {
    const [monsters, setMonsters] = useState<Monster[]>([]);
    const [maps, setMaps] = useState<MapInfo[]>([]);
    const [mapSpawns, setMapSpawns] = useState<MapData[]>([]);
    
    const [selectedMapNumber, setSelectedMapNumber] = useState<number | null>(null);
    const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
    const [selectedSpawn, setSelectedSpawn] = useState<Spawn | null>(null);

    const [monsterImages, setMonsterImages] = useState<Record<string, string>>({});
    const [loadingImage, setLoadingImage] = useState<number | null>(null);
    
    const [showMapPreview, setShowMapPreview] = useState(false);
    const [selectedMonsterForAdd, setSelectedMonsterForAdd] = useState<Monster | null>(null);

    const monsterFileInputRef = useRef<HTMLInputElement>(null);
    const spawnFileInputRef = useRef<HTMLInputElement>(null);
    const mapListFileInputRef = useRef<HTMLInputElement>(null);

    const toCamelCase = (str: string) => {
        if (!str) return '';
        return str.charAt(0).toLowerCase() + str.slice(1);
    }

    const parseAndLoadXml = (xmlString: string, parser: (doc: Document) => void) => {
        try {
            // Sanitize XML comments to prevent parsing errors from double hyphens
            const sanitizedXml = xmlString.replace(/<!--([\s\S]*?)-->/g, (match, commentContent) => {
                const sanitizedContent = commentContent.replace(/--/g, '- -'); // Replace -- with valid sequence
                return `<!--${sanitizedContent}-->`;
            });

            const domParser = new DOMParser();
            const doc = domParser.parseFromString(sanitizedXml, "application/xml");
            const parseError = doc.querySelector("parsererror");
            if (parseError) {
                console.error("Error parsing XML:", parseError.textContent);
                alert("Failed to parse XML file. Check console for details.");
                return;
            }
            parser(doc);
        } catch (error) {
            console.error("Error processing file:", error);
            alert("An error occurred while processing the file.");
        }
    };
    
    const handleLoadMonsterList = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            parseAndLoadXml(content, (doc) => {
                const monsterElements = Array.from(doc.getElementsByTagName("Monster"));
                const loadedMonsters = monsterElements.map(el => {
                    const monster: Partial<Monster> = {};
                    for (const attr of Array.from(el.attributes)) {
                        const key = toCamelCase(attr.name);
                        const value = isNaN(Number(attr.value)) ? attr.value : Number(attr.value);
                        (monster as any)[key] = value;
                    }
                    return monster as Monster;
                });
                setMonsters(loadedMonsters);
                alert(`${loadedMonsters.length} monsters loaded successfully.`);
            });
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleLoadMapList = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            parseAndLoadXml(content, (doc) => {
                const mapElements = Array.from(doc.getElementsByTagName("Map"));
                 const loadedMaps = mapElements.map(el => {
                    const number = parseInt(el.getAttribute("Number") || '0', 10);
                    const fileAttr = el.getAttribute("File") || '';
                    const name = fileAttr.replace(/^\d+_/,'').replace('.att', '');
                    return { number, file: fileAttr, name };
                });
                setMaps(loadedMaps);
                alert(`${loadedMaps.length} maps loaded successfully.`);
            });
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleLoadSpawns = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            parseAndLoadXml(content, (doc) => {
                const mapElements = Array.from(doc.getElementsByTagName("Map"));
                const loadedSpawns: { [key: number]: MapData } = {};
                
                mapElements.forEach(mapEl => {
                    const number = parseInt(mapEl.getAttribute("Number") || '0', 10);
                    const name = mapEl.getAttribute("Name") || `Map ${number}`;

                    if (!loadedSpawns[number]) {
                        loadedSpawns[number] = { number, name, spots: [] };
                    }
                    
                    const spotElements = Array.from(mapEl.getElementsByTagName("Spot"));
                    spotElements.forEach(spotEl => {
                        const spot: Spot = {
                            type: parseInt(spotEl.getAttribute("Type") || '0', 10),
                            description: spotEl.getAttribute("Description") || "No description",
                            spawns: Array.from(spotEl.getElementsByTagName("Spawn")).map(spawnEl => ({
                                uuid: uuidv4(),
                                index: parseInt(spawnEl.getAttribute("Index") || '0', 10),
                                distance: parseInt(spawnEl.getAttribute("Distance") || '0', 10),
                                startX: parseInt(spawnEl.getAttribute("StartX") || '0', 10),
                                startY: parseInt(spawnEl.getAttribute("StartY") || '0', 10),
                                endX: parseInt(spawnEl.getAttribute("EndX") || spawnEl.getAttribute("StartX") || '0', 10),
                                endY: parseInt(spawnEl.getAttribute("EndY") || spawnEl.getAttribute("StartY") || '0', 10),
                                dir: parseInt(spawnEl.getAttribute("Dir") || '-1', 10),
                                count: parseInt(spawnEl.getAttribute("Count") || '1', 10),
                                element: parseInt(spawnEl.getAttribute("Element") || '0', 10),
                            }))
                        };
                        loadedSpawns[number].spots.push(spot);
                    });
                });
                
                const spawnsArray = Object.values(loadedSpawns);
                setMapSpawns(spawnsArray);
                alert(`${spawnsArray.length} maps with spawns loaded.`);
                if (spawnsArray.length > 0) {
                   setSelectedMapNumber(spawnsArray[0].number);
                }
            });
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const allMapsCombined = useMemo(() => {
        const combined = new Map<number, MapInfo>();
        maps.forEach(map => combined.set(map.number, { ...map, name: map.name || `Map ${map.number}` }));
        mapSpawns.forEach(spawnMap => {
            if (!combined.has(spawnMap.number)) {
                combined.set(spawnMap.number, { number: spawnMap.number, name: spawnMap.name, file: '' });
            } else {
                 const existing = combined.get(spawnMap.number)!;
                 if (!existing.name || existing.name.startsWith("Map ")) {
                     existing.name = spawnMap.name;
                 }
            }
        });
        return Array.from(combined.values()).sort((a, b) => a.number - b.number);
    }, [maps, mapSpawns]);
    
    const selectedMapData = useMemo(() => {
        if (selectedMapNumber === null) return null;
        return mapSpawns.find(m => m.number === selectedMapNumber) || { number: selectedMapNumber, name: allMapsCombined.find(m=>m.number === selectedMapNumber)?.name || `Map ${selectedMapNumber}`, spots: []};
    }, [selectedMapNumber, mapSpawns, allMapsCombined]);

    const handleMapSelect = useCallback((mapNumber: number) => {
        setSelectedMapNumber(mapNumber);
        setSelectedMonster(null);
        setSelectedSpawn(null);
        setSelectedMonsterForAdd(null);
    }, []);

    const handleMonsterSelect = useCallback((monster: Monster) => {
        setSelectedMonster(monster);
        setSelectedSpawn(null);
        if (!monsterImages[monster.index]) {
            setLoadingImage(monster.index);
            generateMonsterImage(monster.name).then(imageUrl => {
                setMonsterImages(prev => ({...prev, [monster.index]: imageUrl}));
            }).finally(() => {
                setLoadingImage(null);
            });
        }
    }, [monsterImages]);

    const handleMapMonsterSelect = useCallback((spawn: Spawn) => {
        const monster = monsters.find(m => m.index === spawn.index);
        if (monster) {
            setSelectedMonster(monster);
        }
        setSelectedSpawn(spawn);
    }, [monsters]);

    const handleSetMonsterForAdd = useCallback((monster: Monster) => {
        if (selectedMonsterForAdd?.index === monster.index) {
            setSelectedMonsterForAdd(null);
        } else {
            setSelectedMonsterForAdd(monster);
            setShowMapPreview(true);
        }
    }, [selectedMonsterForAdd]);

    const handleAddSpawn = useCallback((x: number, y: number) => {
        if (!selectedMonsterForAdd || !selectedMapData) return;
        const newSpawn: Spawn = {
            uuid: uuidv4(),
            index: selectedMonsterForAdd.index,
            distance: 5, startX: x, startY: y, endX: x, endY: y, dir: -1, count: 1,
        };

        const updatedSpawns = produce(mapSpawns, draft => {
            let map = draft.find(m => m.number === selectedMapData.number);
            if (!map) {
                map = { number: selectedMapData.number, name: selectedMapData.name, spots: [] };
                draft.push(map);
            }
            let spot = map.spots.find(s => s.type === 2);
            if (!spot) {
                spot = { type: 2, description: "Single Monster Spawn", spawns: [] };
                map.spots.push(spot);
            }
            spot.spawns.push(newSpawn);
        });
        setMapSpawns(updatedSpawns);
    }, [selectedMonsterForAdd, selectedMapData, mapSpawns]);
    
    const handleAddAreaSpawn = useCallback((startX: number, startY: number, endX: number, endY: number) => {
        if (!selectedMonsterForAdd || !selectedMapData) return;
        
        const countStr = prompt(`Enter number of ${selectedMonsterForAdd.name} for this area:`, "10");
        if (countStr === null) return;
        const count = parseInt(countStr, 10);
        if (isNaN(count) || count <= 0) {
            alert("Invalid count entered.");
            return;
        }

        const newSpawn: Spawn = {
            uuid: uuidv4(),
            index: selectedMonsterForAdd.index,
            distance: Math.max(5, Math.round(Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)) / 2)),
            startX, startY, endX, endY, dir: -1, count,
        };

        const updatedSpawns = produce(mapSpawns, draft => {
            let map = draft.find(m => m.number === selectedMapData.number);
            if (!map) {
                map = { number: selectedMapData.number, name: selectedMapData.name, spots: [] };
                draft.push(map);
            }
            let spot = map.spots.find(s => s.type === 1);
            if (!spot) {
                spot = { type: 1, description: "Multiple Monsters Spawn", spawns: [] };
                map.spots.push(spot);
            }
            spot.spawns.push(newSpawn);
        });
        setMapSpawns(updatedSpawns);
    }, [selectedMonsterForAdd, selectedMapData, mapSpawns]);

    const handleDeleteSpawn = useCallback((spawnToDelete: Spawn) => {
        const updatedSpawns = produce(mapSpawns, draft => {
            const map = draft.find(m => m.number === selectedMapData?.number);
            if (map) {
                map.spots.forEach(spot => {
                    spot.spawns = spot.spawns.filter(s => s.uuid !== spawnToDelete.uuid);
                });
                map.spots = map.spots.filter(spot => spot.spawns.length > 0);
            }
        });
        setMapSpawns(updatedSpawns);
        setSelectedSpawn(null);
        setSelectedMonster(null);
    }, [mapSpawns, selectedMapData]);

    const handleSpawnPropertyChange = (uuid: string, field: keyof Spawn, value: string) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue)) return;
        
        const updatedSpawns = produce(mapSpawns, draft => {
            const map = draft.find(m => m.number === selectedMapData?.number);
            if (map) {
                for (const spot of map.spots) {
                    const spawn = spot.spawns.find(s => s.uuid === uuid);
                    if (spawn) {
                        (spawn as any)[field] = numValue;
                        if (selectedSpawn?.uuid === uuid) {
                           setSelectedSpawn({ ...spawn, [field]: numValue });
                        }
                        break;
                    }
                }
            }
        });
        setMapSpawns(updatedSpawns);
    };
    
    const monsterNameMap = useMemo(() => {
        return monsters.reduce((acc, monster) => {
            acc[monster.index] = monster.name;
            return acc;
        }, {} as Record<number, string>);
    }, [monsters]);

    const totalMonsterCount = useMemo(() => {
        return mapSpawns.reduce((total, map) => {
            return total + map.spots.reduce((mapTotal, spot) => {
                return mapTotal + spot.spawns.reduce((spotTotal, spawn) => spotTotal + spawn.count, 0);
            }, 0);
        }, 0);
    }, [mapSpawns]);

    const getSpotTypeName = (type: SpotType) => {
        switch (type) {
            case SpotType.NPC: return "NPC/Traps";
            case SpotType.MultiSpawn: return "Multiple Monsters Spawn";
            case SpotType.SingleSpawn: return "Single Monster Spawn";
            case SpotType.ElementalSpawn: return "Elemental Monster Spawn";
            default: return "Unknown Spot Type";
        }
    };

    return (
        <div className="bg-gray-900 text-gray-200 min-h-screen font-sans flex flex-col">
            <header className="bg-gray-950 p-2 border-b border-gray-700 shadow-lg flex items-center justify-between">
                <h1 className="text-lg font-bold text-gray-100">MU Monster Spawn Editor</h1>
                <div className="flex gap-2">
                    <Button onClick={() => monsterFileInputRef.current?.click()}>Load MonsterList.xml</Button>
                    <Button onClick={() => mapListFileInputRef.current?.click()}>Load MapList.xml</Button>
                    <Button onClick={() => spawnFileInputRef.current?.click()}>Load MonsterSpawn.xml</Button>
                    <input type="file" ref={monsterFileInputRef} onChange={handleLoadMonsterList} style={{ display: 'none' }} accept=".xml" />
                    <input type="file" ref={mapListFileInputRef} onChange={handleLoadMapList} style={{ display: 'none' }} accept=".xml" />
                    <input type="file" ref={spawnFileInputRef} onChange={handleLoadSpawns} style={{ display: 'none' }} accept=".xml" />
                </div>
            </header>
            <main className="flex-grow flex p-4 gap-4 overflow-hidden">
                {/* Left Column */}
                <div className="w-1/3 flex flex-col gap-4">
                     <Card title="Maps" headerContent={<span className="text-xs text-gray-400">{allMapsCombined.length} Maps | Total Monsters: {totalMonsterCount}</span>}>
                        <div className="overflow-y-auto flex-grow">
                            <ul className="p-1 space-y-px">
                                {allMapsCombined.map(map => {
                                     const monsterCount = mapSpawns.find(m => m.number === map.number)?.spots.reduce((acc, spot) => acc + spot.spawns.reduce((sAcc, s) => sAcc + s.count, 0), 0) || 0;
                                    return (
                                        <li key={map.number}
                                            onClick={() => handleMapSelect(map.number)}
                                            className={`text-sm p-2 cursor-pointer rounded-md transition-colors hover:bg-gray-700 flex justify-between items-center ${selectedMapNumber === map.number ? 'bg-blue-800 hover:bg-blue-700' : ''}`}>
                                            <span>{map.number} - {map.name}</span>
                                            <span className="text-xs bg-gray-600 px-2 py-0.5 rounded-full">{monsterCount}</span>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    </Card>
                    <Card title="All Monsters">
                       <div className="overflow-y-auto flex-grow">
                            <ul className="p-1 space-y-px">
                                {monsters.map(monster => (
                                    <li key={monster.index}
                                        onClick={() => handleMonsterSelect(monster)}
                                        className={`text-sm p-2 cursor-pointer rounded-md transition-colors hover:bg-gray-700 flex justify-between items-center ${selectedMonster?.index === monster.index && !selectedSpawn ? 'bg-blue-800 hover:bg-blue-700' : ''}`}>
                                        <span>{monster.name}</span>
                                        {selectedMonsterForAdd?.index === monster.index && <span className="text-xs bg-green-600 px-2 py-0.5 rounded-full">Adding</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </Card>
                </div>

                {/* Center Column */}
                <div className="w-1/3 flex flex-col">
                     <Card title={selectedMapData?.name ? `Monsters in ${selectedMapData.name}` : 'Select a Map'} headerContent={
                        selectedMapData && <Button onClick={() => setShowMapPreview(true)}>Open Map Preview</Button>
                    }>
                       <div className="p-2 overflow-y-auto flex-grow">
                            {selectedMapData?.spots.map((spot, i) => (
                                <div key={`${spot.type}-${i}`} className="mb-3">
                                    <h3 className="text-xs font-semibold text-cyan-400 border-b border-gray-700 mb-2 pb-1">{getSpotTypeName(spot.type)}: <span className="text-gray-400 font-normal">{spot.description}</span></h3>
                                    <ul className="space-y-1">
                                        {spot.spawns.map((spawn) => (
                                            <li key={spawn.uuid} onClick={() => handleMapMonsterSelect(spawn)} 
                                            className={`text-xs bg-gray-700/50 p-2 rounded-md flex justify-between items-center cursor-pointer hover:bg-gray-600/50 ${selectedSpawn?.uuid === spawn.uuid ? 'ring-2 ring-cyan-500' : ''}`}>
                                                <div>
                                                    <span className="font-bold text-gray-300">{monsterNameMap[spawn.index] || 'Unknown'} {spawn.count > 1 ? `(${spawn.count})` : ''}</span>
                                                </div>
                                                 <Button className="bg-red-800 hover:bg-red-700 text-white text-xs !px-2 !py-0.5 rounded-sm" onClick={(e) => { e.stopPropagation(); handleDeleteSpawn(spawn); }}>X</Button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                             {(!selectedMapData || selectedMapData.spots.length === 0) && <p className="text-sm text-gray-400 p-4 text-center">No spawn spots on this map.</p>}
                        </div>
                    </Card>
                </div>

                {/* Right Column */}
                <div className="w-1/3 flex flex-col">
                     <Card title="Details">
                        <div className="p-4 flex-grow overflow-y-auto">
                           {selectedMonster ? (
                            <>
                                <div className="flex gap-4 items-start">
                                    <div className="w-32 h-32 bg-gray-900 flex-shrink-0 flex items-center justify-center border border-gray-700 rounded-md overflow-hidden">
                                        {loadingImage === selectedMonster.index && <Spinner />}
                                        {monsterImages[selectedMonster.index] && <img src={monsterImages[selectedMonster.index]} alt={selectedMonster.name} className="w-full h-full object-cover" />}
                                        {!loadingImage && !monsterImages[selectedMonster.index] && <div className="text-gray-500 text-xs text-center p-2">No image</div>}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-2">{selectedMonster.name}</h3>
                                         <div className="text-xs grid grid-cols-2 gap-x-6 gap-y-1 content-start">
                                            <p>Level: <span className="font-semibold text-gray-300">{selectedMonster.level}</span></p>
                                            <p>HP: <span className="font-semibold text-gray-300">{selectedMonster.hp}</span></p>
                                            <p>Damage: <span className="font-semibold text-gray-300">{selectedMonster.damageMin}-{selectedMonster.damageMax}</span></p>
                                            <p>Defense: <span className="font-semibold text-gray-300">{selectedMonster.defense}</span></p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4">
                                     {selectedSpawn ? (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-semibold text-cyan-400 mt-4 border-t border-gray-700 pt-3">Spawn Properties</h4>
                                             <div className="grid grid-cols-2 gap-2 text-xs">
                                                {Object.entries({
                                                    count: "Count",
                                                    startX: "Start X",
                                                    startY: "Start Y",
                                                    endX: "End X",
                                                    endY: "End Y",
                                                    distance: "Radius",
                                                    dir: "Direction",
                                                }).map(([key, label]) => (
                                                    <div key={key}>
                                                        <label className="block text-gray-400 mb-1">{label}</label>
                                                        <input type="number" value={(selectedSpawn as any)[key]} onChange={e => handleSpawnPropertyChange(selectedSpawn.uuid, key as keyof Spawn, e.target.value)}
                                                        className="w-full bg-gray-900 border border-gray-600 rounded-md p-1 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                                                    </div>
                                                ))}
                                             </div>
                                        </div>
                                     ) : (
                                        <Button className="w-full mt-4" onClick={() => handleSetMonsterForAdd(selectedMonster)}>
                                            {selectedMonsterForAdd?.index === selectedMonster.index ? 'Cancel Adding to Map' : 'Add to Map'}
                                        </Button>
                                     )}
                                </div>
                            </>
                           ) : (
                             <div className="flex items-center justify-center h-full text-gray-500">
                                Select a monster to see details.
                             </div>  
                           )}
                        </div>
                    </Card>
                </div>
            </main>
            {showMapPreview && <MapPreviewWindow 
                show={showMapPreview}
                onClose={() => setShowMapPreview(false)}
                mapData={selectedMapData}
                allMonsters={monsters}
                selectedMonsterForAdd={selectedMonsterForAdd}
                onAddSpawn={handleAddSpawn}
                onAddAreaSpawn={handleAddAreaSpawn}
            />}
        </div>
    );
};

export default App;