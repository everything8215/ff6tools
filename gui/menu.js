//
// menu.js
// created 2/14/2021
//

class ROMMenu {
    constructor() {
        this.div = document.getElementById('menu-div');

        this.topMenu = document.createElement('ul');
        this.topMenu.classList.add('menu');
        this.topMenu.classList.add('top-menu');
        this.div.appendChild(this.topMenu);

        const self = this;
        this.div.onmousedown = function(e) {
            // close menu if user clicks outside
            if (e.target === self.div) self.close();
        };
        this.div.oncontextmenu = function(e) { self.close(); };
    }

    open(x, y) {
        this.div.classList.add('visible');
        this.setMenuPosition(this.topMenu, x, y);
    }

    close() {
        this.div.classList.remove('visible');
        this.div.innerHTML = '';
    }

    createSubMenu(parent) {
        const subMenu = document.createElement('ul');
        subMenu.classList.add('menu');
        parent.appendChild(subMenu);
        parent.classList.add('has-submenu')
        return subMenu;
    }

    createMenuItem(parent, options) {
        options = options || {};
        const li = document.createElement('li');
        li.classList.add('menu-item');
        if (options.name) li.innerHTML = options.name;
        const numberValue = Number(options.value);
        if (isNumber(numberValue)) li.value = numberValue;
        if (options.value) li.setAttribute('data-value', options.value);
        if (options.selected) li.classList.add('selected');
        if (options.disabled) li.classList.add('disabled');
        if (options.onclick && !options.disabled) li.onclick = options.onclick;
        parent.appendChild(li);
        return li;
    }

    setMenuPosition(menu, x, y) {

        // make menu visible temporarily
        menu.style.display = 'block';

        // calculate horizontal position
        let left = x;
        const width = menu.clientWidth;
        if ((width + left) > window.innerWidth) {
            // shift the menu left so it doesn't go past the side of the window
            left = Math.max(window.innerWidth - width, 0);
        }
        menu.style.left = `${left}px`;

        // calculate vertical position
        let top = y;
        menu.style.height = '';
        menu.classList.remove('full-height');
        const height = menu.clientHeight;
        if ((height + top) > window.innerHeight) {
            // shift the menu up so it doesn't go past the bottom of the window
            top = window.innerHeight - height;
        }
        if (top < 0) {
            // make the menu full-height with scroller
            menu.style.height = `${window.innerHeight - 10}px`;
            menu.classList.add('full-height');
            top = 0;
        }
        menu.style.top = `${top}px`;

        // update menu position for all child menus
        for (const menuItem of menu.children) {
            if (!menuItem.classList.contains('has-submenu')) continue;
            for (const child of menuItem.children) {
                if (child.classList.contains('menu')) {
                    const x = menu.offsetLeft + menu.offsetWidth;
                    const y = menu.offsetTop + menuItem.offsetTop - 5;
                    this.setMenuPosition(child, x, y);
                }
            }
        }

        // make menu not visible
        menu.style.display = '';
    }
}
