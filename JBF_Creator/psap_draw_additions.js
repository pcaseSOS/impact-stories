// Code to add polygon drawing functionality to the PSAP map
function initializeDrawingTools(view, projection, SpatialReference) {
    // Create a graphics layer for the drawn polygons
    const drawLayer = new esri.layers.GraphicsLayer({
        title: "User-Drawn Polygons"
    });
    
    // Add the graphics layer to the map
    view.map.add(drawLayer);
    
    // Create the sketch widget
    const sketch = new esri.widgets.Sketch({
        layer: drawLayer,
        view: view,
        creationMode: "update",
        availableCreateTools: ["polygon"], // Only allow polygon creation
        defaultCreateOptions: {
            mode: "click" // Default to click-by-click polygon creation
        },
        visibleElements: {
            createTools: {
                point: false,
                polyline: false,
                polygon: true,
                rectangle: false,
                circle: false
            },
            selectionTools: {
                "lasso-selection": false,
                "rectangle-selection": false
            },
            undoRedoMenu: true,
            settingsMenu: false
        }
    });
    
    // Add the sketch widget to the top-right of the view
    view.ui.add(sketch, "top-right");
    
    // Create a button for downloading the drawn polygons
    const downloadDrawnBtn = document.createElement("button");
    downloadDrawnBtn.id = "downloadDrawnBtn";
    downloadDrawnBtn.className = "esri-button esri-button--primary";
    downloadDrawnBtn.innerHTML = "📥 Download Drawn Polygon";
    downloadDrawnBtn.title = "Download the drawn polygon as GeoJSON";
    downloadDrawnBtn.style.display = "none"; // Initially hidden until drawing exists
    
    // Add the download button to the UI
    view.ui.add(downloadDrawnBtn, "top-right");
    
    // Show the download button when graphics are added
    sketch.on("create", function(event) {
        if (event.state === "complete") {
            downloadDrawnBtn.style.display = "block";
            
            // Update status message
            const status = document.getElementById('status');
            status.textContent = "Polygon drawn! You can now download it or continue editing.";
        }
    });
    
    // Also show the download button when graphics exist at startup
    if (drawLayer.graphics.length > 0) {
        downloadDrawnBtn.style.display = "block";
    }
    
    // Enable the download button
    downloadDrawnBtn.addEventListener("click", async function() {
        // Get all graphics from the draw layer
        const graphics = drawLayer.graphics.toArray();
        
        if (graphics.length === 0) {
            alert("No polygons drawn! Draw a polygon first.");
            return;
        }
        
        try {
            // Process each graphic and convert to GeoJSON
            const features = await Promise.all(graphics.map(async (graphic, index) => {
                // Convert coordinates with proper projection
                const coordinates = await convertGeometryToGeoJSON(graphic.geometry, projection, SpatialReference);
                
                return {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: coordinates
                    },
                    properties: {
                        id: index + 1,
                        name: `User Drawn Polygon ${index + 1}`,
                        drawn_date: new Date().toISOString(),
                        export_metadata: {
                            exported_date: new Date().toISOString(),
                            source: "User Drawing",
                            target_crs: "EPSG:4326",
                            target_crs_name: "WGS 84"
                        }
                    }
                };
            }));
            
            // Create GeoJSON object
            const geoJSON = {
                type: "FeatureCollection",
                crs: {
                    type: "name",
                    properties: {
                        name: "urn:ogc:def:crs:EPSG::4326"
                    }
                },
                metadata: {
                    exported_by: "RapidSOS PSAP Map - Drawing Tool",
                    export_date: new Date().toISOString(),
                    feature_count: features.length
                },
                features: features
            };
            
            // Create and download the file
            const dataStr = JSON.stringify(geoJSON, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            
            // Create download link
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            
            // Create filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `user_drawn_polygons_${timestamp}.geojson`;
            
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
            
            // Update status
            const status = document.getElementById('status');
            status.textContent = `Downloaded ${features.length} drawn polygon(s) as GeoJSON`;
        } catch (error) {
            console.error('Error downloading drawn polygons:', error);
            alert('Error downloading drawn polygons. Please try again.');
            
            // Update status
            const status = document.getElementById('status');
            status.textContent = 'Error during download';
        }
    });
    
    // Function to convert a geometry to GeoJSON coordinates
    async function convertGeometryToGeoJSON(geometry, projection, SpatialReference) {
        try {
            // Create target spatial reference (WGS84 / EPSG:4326)
            const wgs84 = new SpatialReference({ wkid: 4326 });

            let projectedGeometry = geometry;

            // Check if geometry needs projection
            if (geometry.spatialReference && geometry.spatialReference.wkid !== 4326) {
                console.log(`Projecting from EPSG:${geometry.spatialReference.wkid} to EPSG:4326`);

                // Load projection engine if not already loaded
                await projection.load();

                // Project geometry to WGS84
                projectedGeometry = projection.project(geometry, wgs84);
            }

            // Convert to GeoJSON coordinate format
            if (projectedGeometry.rings) {
                // Polygon geometry
                return projectedGeometry.rings.map(ring =>
                    ring.map(coord => [coord[0], coord[1]])
                );
            } else if (projectedGeometry.paths) {
                // Polyline geometry
                return projectedGeometry.paths.map(path =>
                    path.map(coord => [coord[0], coord[1]])
                );
            } else if (projectedGeometry.points) {
                // Multipoint geometry
                return projectedGeometry.points.map(point => [point.x, point.y]);
            } else if (projectedGeometry.x && projectedGeometry.y) {
                // Point geometry
                return [projectedGeometry.x, projectedGeometry.y];
            }

            return [];
        } catch (error) {
            console.error('Error converting geometry coordinates:', error);
            console.log('Falling back to original coordinates');

            // Fallback to original method if projection fails
            if (geometry.rings) {
                return geometry.rings.map(ring =>
                    ring.map(coord => [coord[0], coord[1]])
                );
            }
            return [];
        }
    }
    
    // Add help tooltip
    const helpBtn = document.createElement("button");
    helpBtn.id = "helpDrawBtn";
    helpBtn.className = "esri-button esri-button--tertiary";
    helpBtn.innerHTML = "❓ Help";
    helpBtn.title = "How to use drawing tools";
    
    view.ui.add(helpBtn, "top-right");
    
    // Show help when clicked
    helpBtn.addEventListener("click", function() {
        alert("Drawing Tool Instructions:\n\n" +
              "1. Click the polygon button in the sketch toolbar\n" +
              "2. Click on the map to create polygon vertices\n" +
              "3. Double-click to complete the polygon\n" +
              "4. Use the edit tools to modify your polygon\n" +
              "5. Click 'Download Drawn Polygon' to save as GeoJSON\n\n" +
              "You can still view and select PSAP boundaries as reference.");
    });
    
    // Return useful components
    return {
        sketch: sketch,
        drawLayer: drawLayer,
        downloadDrawnBtn: downloadDrawnBtn
    };
}
