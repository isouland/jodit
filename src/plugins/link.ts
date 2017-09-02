import Jodit from '../Jodit';
import {Config} from '../Config'
import {isURL, convertMediaURLToVideoEmbed, dom, val} from '../modules/Helpers'
import Dom from "../modules/Dom";
import {ControlType} from "../modules/Toolbar";

/**
* @property {object}  link `{@link module:link|link}` plugin's options
* @property {boolean} link.followOnDblClick=true Follow lnk address after dblclick
* @property {boolean} link.processVideoLink=true Replace inserted youtube/vimeo link toWYSIWYG `iframe`
* @property {boolean} link.processPastedLink=true Wrap inserted link in &lt;a href="link">link&lt;/a>
* @property {boolean} link.openLinkDialogAfterPost=true Open Link dialog after post
* @property {boolean} link.removeLinkAfterFormat=true When the button is pressed toWYSIWYG clean format, if it was done on the link is removed like command `unlink`
*/

declare module "../Config" {
    interface Config {
        link: {
            followOnDblClick: boolean;
            processVideoLink: boolean;
            processPastedLink: boolean;
            openLinkDialogAfterPost: boolean;
            removeLinkAfterFormat: boolean;
        }
    }
}
Config.prototype.link = {
    followOnDblClick: true,
    processVideoLink: true,
    processPastedLink: true,
    openLinkDialogAfterPost: true,
    removeLinkAfterFormat: true,
};


Config.prototype.controls.unlink = {
    exec: (editor: Jodit, current: Node) => {
        let anchor: HTMLAnchorElement|false = <HTMLAnchorElement>Dom.closest(current, 'A', editor.editor);
        if (anchor) {
            Dom.unwrap(anchor);
        }
        editor.events.fire('hidePopup');
    }
};
Config.prototype.controls.link = {
    popup: (editor: Jodit, current: HTMLElement|false, self: ControlType, close: Function) => {
        const sel: Selection = editor.win.getSelection(),
            form: HTMLFormElement = <HTMLFormElement>dom(
                '<form class="jodit_form">' +
                    '<input required type="text" name="url" placeholder="http://" type="text"/>' +
                    '<input name="text" placeholder="' + editor.i18n('Text') + '" type="text"/>' +
                    '<label>' +
                        '<input name="target" type="checkbox"/> ' + editor.i18n('Open in new tab') +
                    '</label>' +
                    '<label>' +
                        '<input name="nofollow" type="checkbox"/> ' + editor.i18n('No follow') +
                    '</label>' +
                    '<div style="text-align: right">' +
                        '<button class="jodit_unlink_button" type="button">' + editor.i18n('Unlink') + '</button> &nbsp;&nbsp;' +
                        '<button class="jodit_link_insert_button" type="submit"></button>' +
                    '</div>' +
                '<form/>'
            );

        if (current && Dom.closest(current, 'A', editor.editor)) {
            current = <HTMLElement>Dom.closest(current, 'A', editor.editor)
        } else {
            current = false;
        }

        if (current) {
            val(form, 'input[name=url]', current.getAttribute('href'));
            val(form, 'input[name=text]', current.innerText);

            (<HTMLInputElement>form.querySelector('input[name=target]')).checked = (current.getAttribute('target') === '_blank');
            (<HTMLInputElement>form.querySelector('input[name=nofollow]')).checked = (current.getAttribute('rel') === 'nofollow');

            form.querySelector('.jodit_link_insert_button').innerHTML = editor.i18n('Update');
        } else {
            (<HTMLButtonElement>form.querySelector('.jodit_unlink_button')).style.display = 'none';
            val(form, 'input[name=text]', sel.toString());
            form.querySelector('.jodit_link_insert_button').innerHTML = editor.i18n('Insert');
        }

        const selInfo = editor.selection.save();

        form.querySelector('.jodit_unlink_button').addEventListener('mousedown', (e: MouseEvent) => {
            if (current) {
                Dom.unwrap(current);
            }
            editor.selection.restore(selInfo);
            close();
            e.preventDefault();
        });

        form.addEventListener('submit', (event: Event) => {
            event.preventDefault();
            editor.selection.restore(selInfo);

            let a: HTMLAnchorElement = <HTMLAnchorElement>current || <HTMLAnchorElement>Dom.create('a', '', editor.doc);

            if (!val(form, 'input[name=url]')) {
                (<HTMLInputElement>form.querySelector('input[name=url]')).focus();
                (<HTMLInputElement>form.querySelector('input[name=url]')).classList.add('jodit_error');
                return false;
            }


            a.setAttribute('href', val(form, 'input[name=url]'));
            a.innerText = val(form, 'input[name=text]');

            if ((<HTMLInputElement>form.querySelector('input[name=target]')).checked) {
                a.setAttribute('target', '_blank');
            } else {
                a.removeAttribute('target');
            }

            if ((<HTMLInputElement>form.querySelector('input[name=nofollow]')).checked) {
                a.setAttribute('rel', 'nofollow');
            } else {
                a.removeAttribute('rel');
            }

            if (!current) {
                editor.selection.insertNode(a);
            }

            close();
            return false;
        });

        return form;
    },
    tags: ["a"],
    tooltip: "Insert link"
};

/**
 * Process link
 *
 * @module plugins/link
 */
export default function (jodit: Jodit) {
    if (jodit.options.link.followOnDblClick) {
        jodit.events.on('afterInit', () => {
            jodit.__on(jodit.editor, 'dblclick', 'a', function (this: HTMLAnchorElement, e: MouseEvent) {
                if (this.getAttribute('href')) {
                    location.href = this.getAttribute('href');
                    e.preventDefault();
                }
            });
        });
    }
    if (jodit.options.link.processPastedLink) {
        jodit.events.on('processPaste', function (event, html) {
            if (isURL(html)) {
                let a;
                if (convertMediaURLToVideoEmbed(html) !== html) {
                    a = convertMediaURLToVideoEmbed(html);
                } else {
                    a = jodit.doc.createElement('a');
                    a.setAttribute('href', html);
                    a.innerText = html;
                    if (jodit.options.link.openLinkDialogAfterPost) {
                        setTimeout(() => {
                            //parent.selection.moveCursorTo(a, true);
                            //editor.selection.selectNodes(Array.prototype.slice.call(a.childNodes));
                        }, 100);
                    }
                }
                return a;
            }
        });
    }
    if (jodit.options.link.removeLinkAfterFormat) {
        jodit.events.on('afterCommand', function (command) {
            let sel = jodit.selection,
                newtag,
                node;

            if (command === 'removeFormat') {
                node = sel.current();
                if (node && node.tagName !== 'A') {
                    node = Dom.closest(node, 'A', jodit.editor);
                }
                if (node && node.tagName === 'A') {
                    if (node.innerHTML === node.innerText) {
                        newtag = Dom.create('text', node.innerText, jodit.doc);
                    } else {
                        newtag = Dom.create('span', node.innerHTML, jodit.doc);
                    }
                    node.parentNode.replaceChild(newtag, node);
                    jodit.selection.setCursorIn(newtag, true);
                }
            }
        });
    }
};