"use client";

import React, { useRef } from 'react';
import Image from "next/image";
import { motion, useInView } from "framer-motion";

// Individual Logo Component with hover effects
const NetworkLogo = ({ src, alt }: { src: string; alt: string }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.1, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.95 }}
      className="relative h-12 w-32 flex items-center justify-center group"
    >
      <Image
        src={src}
        alt={alt}
        width={100}
        height={40}
        className="object-contain h-full w-full opacity-40 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500 group-hover:drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]"
      />
    </motion.div>
  );
};

// Group component for the marquee loop
const NetworkGroup = ({ networks }: { networks: { src: string; alt: string }[] }) => {
  return (
    <div className="flex items-center gap-20 whitespace-nowrap">
      {networks.map((network, i) => (
        <NetworkLogo key={i} src={network.src} alt={network.alt} />
      ))}
    </div>
  );
};

export default function Ecosystem() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  const networks = [
    { src: "/celo.svg", alt: "Celo" },
    { src: "/base.svg", alt: "Base" },
    { src: "/lisk.svg", alt: "Lisk" },
    { src: "/arbitrum.svg", alt: "Arbitrum" },
    { src: "/self.svg", alt: "self" }
  ];

  return (
    <section 
      ref={ref} 
      className="py-32 border-t border-white/5 relative overflow-hidden"
      style={{ backgroundColor: '#030712' }}
    >
      {/* Centered container to prevent border-touching */}
      <div className="max-w-7xl mx-auto px-8">
        <motion.div 
          className="flex flex-col items-center justify-center gap-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <div className="space-y-4">
            <h2 className="text-sm font-black text-blue-500 uppercase tracking-[0.3em]">
              Multi-Chain Ecosystem
            </h2>
            <h3 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight max-w-4xl">
              The future of Web3 user acquisition is automated, verifiable and fun.
            </h3>
          </div>

          {/* Infinite Marquee Container */}
          <div className="relative w-full overflow-hidden py-10">
            {/* Edge Fades for professional look */}
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#030712] to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#030712] to-transparent z-10 pointer-events-none" />

            <motion.div 
              className="flex items-center gap-20 w-max"
              animate={{ x: [0, -1000] }}
              transition={{
                duration: 30,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              {[...Array(4)].map((_, i) => (
                <NetworkGroup key={i} networks={networks} />
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}