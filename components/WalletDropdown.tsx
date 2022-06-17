import { ChevronDownIcon } from '@heroicons/react/solid'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'

export default function WalletDropdown({enableWallet, address} 
    : {enableWallet: (wallet?: string) => Promise<void>, address: string}) {
        const ADDRESS_LENGTH = address.length / 8
        const ellipsisAddress = address.slice(0, ADDRESS_LENGTH) + "..." + address.slice(address.length - ADDRESS_LENGTH)
    return (
      <Menu as="div" className="relative inline-block text-left">
        <Menu.Button
            className="inline-flex justify-center w-full px-4 py-2 text-sm font-medium text-white bg-black rounded-md bg-opacity-20 hover:bg-opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
        >
            <h2 style={{overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: "60vw"}}>
                {address === '' ? 'Get started by connecting your wallet' : ellipsisAddress}
            </h2>
            <ChevronDownIcon
              className="w-5 h-5 ml-2 -mr-1 text-blue-200 hover:text-blue-100"
              aria-hidden="true"
            />
        </Menu.Button>
        <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
        >
            <Menu.Items className="absolute right-0 w-56 mt-2 origin-top-right z-50 bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <Menu.Item>
                    {({ active }) => (
                        <button className={`${
                            active ? 'bg-blue-500 text-white' : 'text-gray-900'
                            } group flex rounded-md items-center w-full px-2 py-2 text-sm`} 
                            onClick={() => enableWallet('nami')}
                        >
                            Nami
                        </button>
                    )}
                </Menu.Item>
                <Menu.Item>
                    {({ active }) => (
                    <button className={`${
                        active ? 'bg-blue-500 text-white' : 'text-gray-900'
                        } group flex rounded-md items-center w-full px-2 py-2 text-sm`} 
                        onClick={() => enableWallet('eternl')}
                    >
                        Eternl
                    </button>
                    )}
                </Menu.Item>
                <Menu.Item>
                    {({ active }) => (
                    <button className={`${
                        active ? 'bg-blue-500 text-white' : 'text-gray-900'
                        } group flex rounded-md items-center w-full px-2 py-2 text-sm`} 
                        onClick={() => enableWallet('flint')}
                    >
                        Flint
                    </button>
                    )}
                </Menu.Item>
            </Menu.Items>
        </Transition>
      </Menu>
    )
}