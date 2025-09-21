import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaybackTracking } from './playback-tracking';

describe('PlaybackTracking', () => {
  let component: PlaybackTracking;
  let fixture: ComponentFixture<PlaybackTracking>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaybackTracking]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlaybackTracking);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
