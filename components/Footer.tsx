import React from 'react'
import Image from 'next/image';

export default function Footer() {
    return (
        <footer>
            <div className='flex justify-center border-t-2 p-4'>
            Powered by{``}
            <span>
            <a
                href="https://cardano.org"
                target="_blank"
                rel="noopener noreferrer"
            >
                <Image
                src="/cardano-logo.svg"
                alt="Cardano Logo"
                width={24}
                height={24}
                />
            </a>
            </span>
            <span>
            <a
                href="https://theadadao.com"
                target="_blank"
                rel="noopener noreferrer"
            >
                <Image
                src="/adao-full-logo.svg"
                alt="Cardano Logo"
                width={24}
                height={24}
                />
            </a>
            </span>
            </div>
        </footer>
    )
}