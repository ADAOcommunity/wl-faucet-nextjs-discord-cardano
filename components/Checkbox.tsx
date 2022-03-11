import React, { useState } from 'react';

export default function Checkbox({checkboxData}) {
    const [isChecked, setIsChecked] = useState(false)

    const checkHandler = () => {
        setIsChecked(!isChecked)
        return isChecked
    }

    return (
        <section>
            <div>
                <input 
                    type="checkbox"
                    id="checkbox"
                    checked={isChecked}
                    onChange={() => checkboxData(checkHandler())}
                />
                <label htmlFor="checkbox">I agree to the Terms of Service </label>
                <p>By checking this box and claiming these tokens you are agreeing to and effectively ratifying the Constitution of the ADAO's Community.
Each token represents a direct link to the governance of ADAO, a decentralized organization dedicated to fulfilling the mission of “Decentralization Together”. -ADAO</p>
            </div>
        </section> 
    )
}