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
            </div>
        </section> 
    )
}