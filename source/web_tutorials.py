"""Searchable, accessible short-video lessons for the public device UI."""
import json
from html import escape
from pathlib import Path

from docutils import nodes
from docutils.parsers.rst import Directive


class WebTutorials(Directive):
    required_arguments = 1

    def run(self):
        catalogue = Path(__file__).resolve().parent / '_static/web-tutorials/catalog.json'
        self.state.document.settings.env.note_dependency(str(catalogue))
        groups = json.loads(catalogue.read_text(encoding='utf-8'))
        selected = [group for group in groups if self.arguments[0] in ('all', group['id'])]
        if not selected:
            raise self.error('Unknown tutorial group: ' + self.arguments[0])
        output = []
        for group in selected:
            section = nodes.section(ids=['tutorial-' + group['id']])
            section += nodes.title(text=group['title'])
            section += nodes.paragraph(text=group['intro'])
            for lesson in group['lessons']:
                identity = lesson['id']
                article = nodes.section(ids=[identity], classes=['web-lesson'])
                article += nodes.title(text=lesson['title'])
                article += nodes.paragraph(text=lesson['purpose'])
                steps = ''.join(
                    '<button type="button" data-tutorial-time="{}"><span>{:02d}</span>{}</button>'.format(
                        step['time'], number, escape(step['text']))
                    for number, step in enumerate(lesson['steps'], 1))
                media = ('<div class="web-tutorial-player" data-web-tutorial>'
                         '<div class="web-tutorial-screen"><video controls playsinline preload="none" '
                         'poster="_static/web-tutorials/{id}.jpg" aria-label="{title}" '
                         'aria-describedby="{id}-transcript">'
                         '<source src="_static/web-tutorials/{id}.webm" type="video/webm">'
                         '<track kind="captions" src="_static/web-tutorials/{id}.vtt" '
                         'srclang="zh-CN" label="简体中文">'
                         '浏览器无法播放时，请阅读操作步骤。</video></div>'
                         '<div class="web-tutorial-directions" id="{id}-transcript">'
                         '<p class="web-tutorial-label">操作指南 · 约 {duration} 秒</p>'
                         '<p class="web-tutorial-disclosure">真实界面 · 演示数据，不连接设备</p>'
                         '<div class="web-tutorial-steps">{steps}</div></div></div>').format(
                             id=identity, title=escape(lesson['title'], quote=True),
                             duration=lesson['duration'], steps=steps)
                article += nodes.raw('', media, format='html')
                article += nodes.paragraph(text='确认结果：' + lesson['result'])
                article += nodes.paragraph(text='注意：' + lesson['caution'])
                section += article
            output.append(section)
        return output


def setup(app):
    app.add_directive('web-tutorials', WebTutorials)
    return {'parallel_read_safe': True, 'parallel_write_safe': True}
