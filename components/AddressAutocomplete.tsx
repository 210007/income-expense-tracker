"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google: any;
    _initGoogleMapsPlaces: () => void;
  }
}

export interface AddressComponents {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onComponents?: (parts: AddressComponents) => void;
  className?: string;
  placeholder?: string;
}

export default function AddressAutocomplete({ value, onChange, onComponents, className, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    const init = () => {
      if (!inputRef.current || !window.google?.maps?.places) return;
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        fields: ["formatted_address", "address_components"],
      });
      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (place?.formatted_address) {
          onChange(place.formatted_address);
        }
        if (onComponents && place?.address_components) {
          const get = (type: string, short = false) => {
            const comp = place.address_components.find((c: any) => c.types.includes(type));
            return comp ? (short ? comp.short_name : comp.long_name) : "";
          };
          const streetNum = get("street_number");
          const route = get("route");
          onComponents({
            street: [streetNum, route].filter(Boolean).join(" "),
            city: get("locality") || get("sublocality") || get("postal_town"),
            state: get("administrative_area_level_1", true),
            zip: get("postal_code"),
          });
        }
      });
    };

    if (window.google?.maps?.places) {
      init();
    } else {
      window._initGoogleMapsPlaces = init;
      if (!document.getElementById("google-maps-script")) {
        const script = document.createElement("script");
        script.id = "google-maps-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=_initGoogleMapsPlaces`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);

  return (
    <input
      ref={inputRef}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}
