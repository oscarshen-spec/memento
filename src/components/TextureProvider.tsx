import React, { createContext, useContext, useState, useEffect } from 'react';
import { generateWoodTexture } from '../services/textureService';

interface TextureContextType {
  deskTexture: string | null;
  drawerTexture: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const TextureContext = createContext<TextureContextType>({
  deskTexture: null,
  drawerTexture: null,
  isLoading: true,
  refresh: async () => {},
});

export const useTextures = () => useContext(TextureContext);

export const TextureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deskTexture, setDeskTexture] = useState<string | null>(null);
  const [drawerTexture, setDrawerTexture] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTextures = async () => {
    setIsLoading(true);
    
    // Generate desk texture
    const desk = await generateWoodTexture("A seamless top-down photograph of a rustic hardwood floor or workbench made of horizontal wood planks. Warm medium brown tones — honey to sienna, not too dark. Visible plank seams running left to right. Natural wood grain along each board, scattered knots, subtle aging and color variation between planks. No objects, no people, no furniture, matte finish.");
    if (desk) setDeskTexture(desk);

    // Generate drawer texture (slightly different or darker)
    const drawer = await generateWoodTexture("A seamless close-up macro photograph of smooth hardwood veneer or solid wood surface. Warm reddish-brown tones, slightly darker than a honey-sienna desk. Fine, continuous wood grain running horizontally, no plank seams, no knots. Matte, slightly shadowed finish as if lit from above. No objects, no people.");
    if (drawer) setDrawerTexture(drawer);

    setIsLoading(false);
  };

  useEffect(() => {
    fetchTextures();
  }, []);

  useEffect(() => {
    if (deskTexture) {
      document.documentElement.style.setProperty('--desk-texture', `url(${deskTexture})`);
    }
    if (drawerTexture) {
      document.documentElement.style.setProperty('--drawer-texture', `url(${drawerTexture})`);
    }
  }, [deskTexture, drawerTexture]);

  return (
    <TextureContext.Provider value={{ deskTexture, drawerTexture, isLoading, refresh: fetchTextures }}>
      {children}
    </TextureContext.Provider>
  );
};
