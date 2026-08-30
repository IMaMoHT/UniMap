import React from 'react';
import './SettingsContainer.css';
import MenuLink from '../MenuLink/MenuLink';
import UiwlinkImg from '../../../Sprite/Ui-Link.svg';
import FacebookImg from '../../../Sprite/Facebook-icon.svg';

/**
 * Зовнішні посилання університету.
 * Instagram і «Settings» прибрано на прохання замовника (Settings нічого не робив —
 * href був порожній).
 */
const SettingsContainer: React.FC = () => {
  return (
    <nav className="SettingsContainer" aria-label="Посилання">
      <ul>
        <MenuLink icon={UiwlinkImg} text="Website" href="https://btsau.com.ua/" target="_blank" rel="noopener noreferrer" />
        <MenuLink icon={FacebookImg} text="Facebook" href="https://www.facebook.com/bnau.bc/" target="_blank" rel="noopener noreferrer" />
      </ul>
    </nav>
  );
};

export default SettingsContainer;
